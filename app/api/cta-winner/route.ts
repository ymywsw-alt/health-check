import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseServer() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    throw new Error("Missing Supabase env: SUPABASE_URL / SUPABASE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type ActiveExperiment = {
  page: string;
  test_id: string;
  variants: string[]; // jsonb array
  min_enters_per_variant: number;
  min_abs_lift: number;
  lock_enabled: boolean;
  lock_ttl_hours: number | null;
};

type MetricRow = {
  page: string;
  variant: string;
  enters: number;
  clicks: number;
  rate: number; // clicks/enters
};

function asNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Attempts to read winner lock row.
 * Works even if schema differs slightly, as long as columns are compatible.
 */
async function getExistingLock(supabase: any, page: string) {
  // Try common column names; ignore missing columns safely by selecting *
  const { data, error } = await supabase
    .from("cta_winner_locks_v1")
    .select("*")
    .eq("page", page)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return { lock: null, error };
  const lock = (data && data[0]) || null;
  return { lock, error: null };
}

function lockIsExpired(lock: any) {
  // Prefer explicit expires_at if present
  const expiresAt =
    lock?.expires_at || lock?.lock_expires_at || lock?.expiresAt || null;
  if (expiresAt) {
    const t = new Date(expiresAt).getTime();
    return Number.isFinite(t) ? t <= Date.now() : false;
  }
  return false; // if no expires column, treat as non-expiring
}

async function writeLock(
  supabase: any,
  args: {
    page: string;
    test_id: string;
    winner: string;
    reason: string;
    lock_ttl_hours: number | null;
    meta?: any;
  }
) {
  const { page, test_id, winner, reason, lock_ttl_hours, meta } = args;

  // Compute expires if ttl provided
  let expires_at: string | null = null;
  if (lock_ttl_hours && lock_ttl_hours > 0) {
    const ms = lock_ttl_hours * 60 * 60 * 1000;
    expires_at = new Date(Date.now() + ms).toISOString();
  }

  // Insert with flexible columns: try a superset payload
  const payload: any = {
    page,
    test_id,
    winner,
    lock_reason: reason,
    reason,
    locked_at: nowIso(),
    updated_at: nowIso(),
    expires_at,
    lock_expires_at: expires_at,
    meta: meta ?? null,
  };

  const { data, error } = await supabase
    .from("cta_winner_locks_v1")
    .insert(payload)
    .select("*")
    .limit(1);

  // If schema rejects unknown columns, retry with minimal payload
  if (error) {
    const minimal: any = { page, test_id, winner, updated_at: nowIso() };
    const retry = await supabase
      .from("cta_winner_locks_v1")
      .insert(minimal)
      .select("*")
      .limit(1);

    if (retry.error) {
      return { ok: false, error: retry.error };
    }
    return { ok: true, row: retry.data?.[0] ?? null };
  }

  return { ok: true, row: data?.[0] ?? null };
}

async function readActiveExperiment(supabase: any, page: string) {
  const { data, error } = await supabase
    .from("cta_experiment_active_v1")
    .select(
      "page,test_id,variants,min_enters_per_variant,min_abs_lift,lock_enabled,lock_ttl_hours"
    )
    .eq("page", page)
    .limit(1);

  if (error) return { exp: null, error };
  const exp = (data && data[0]) || null;
  if (!exp) return { exp: null, error: null };

  // Normalize variants jsonb
  const variants = Array.isArray(exp.variants)
    ? exp.variants
    : typeof exp.variants === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(exp.variants);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  const normalized: ActiveExperiment = {
    page: String(exp.page),
    test_id: String(exp.test_id),
    variants: variants.map(String),
    min_enters_per_variant: asNumber(exp.min_enters_per_variant, 50),
    min_abs_lift: asNumber(exp.min_abs_lift, 0.02),
    lock_enabled: Boolean(exp.lock_enabled),
    lock_ttl_hours:
      exp.lock_ttl_hours === null || exp.lock_ttl_hours === undefined
        ? null
        : asNumber(exp.lock_ttl_hours, null as any),
  };

  return { exp: normalized, error: null };
}

async function readMetrics(
  supabase: any,
  page: string,
  variants: string[],
  testOnly: boolean
) {
  // cta_variant_metrics_v2 is a view with is_test included (per baseline).
  // We filter page + is_test and limit to our variants.
  let q = supabase
    .from("cta_variant_metrics_v2")
    .select("page,variant,enters,clicks,rate")
    .eq("page", page);

  if (testOnly) q = q.eq("is_test", true);

  // supabase-js supports .in
  q = q.in("variant", variants);

  const { data, error } = await q;

  if (error) return { rows: [] as MetricRow[], error };

  const rows: MetricRow[] = (data || []).map((r: any) => ({
    page: String(r.page),
    variant: String(r.variant),
    enters: asNumber(r.enters, 0),
    clicks: asNumber(r.clicks, 0),
    rate: asNumber(r.rate, 0),
  }));

  return { rows, error: null };
}

function pickWinner(
  rows: MetricRow[],
  min_enters_per_variant: number,
  min_abs_lift: number
) {
  // Gate: only variants with enough enters are eligible
  const eligible = rows
    .filter((r) => r.enters >= min_enters_per_variant)
    .sort((a, b) => b.rate - a.rate);

  if (eligible.length === 0) {
    return {
      ok: false,
      reason: "MIN_ENTERS_PER_VARIANT_NOT_MET",
      winner: null as string | null,
      debug: { eligibleCount: 0 },
    };
  }

  const best = eligible[0];
  const runner = eligible[1] || null;

  // Gate: lift vs runner-up (or vs 0 if only one eligible)
  const runnerRate = runner ? runner.rate : 0;
  const absLift = best.rate - runnerRate;

  if (eligible.length >= 2 && absLift < min_abs_lift) {
    return {
      ok: false,
      reason: "MIN_ABS_LIFT_NOT_MET",
      winner: null as string | null,
      debug: { best, runner, absLift, min_abs_lift },
    };
  }

  return {
    ok: true,
    reason: "WINNER_SELECTED",
    winner: best.variant,
    debug: { best, runner, absLift, min_abs_lift },
  };
}

/**
 * GET /api/cta-winner?page=sleep
 * Returns:
 *  - If lock exists and not expired: locked winner
 *  - Else: computed winner if gates pass; if lock_enabled, write lock
 *  - Else: no-winner state with reason + metrics snapshot
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = (url.searchParams.get("page") || "").trim().toLowerCase();

    if (!page) {
      return NextResponse.json(
        { ok: false, error: "Missing required param: page" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // 1) Read active experiment policy for this page
    const { exp, error: expErr } = await readActiveExperiment(supabase, page);
    if (expErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to read active experiment", detail: expErr },
        { status: 500 }
      );
    }
    if (!exp) {
      return NextResponse.json(
        {
          ok: true,
          page,
          has_active_experiment: false,
          winner_locked: false,
          winner: null,
          reason: "NO_ACTIVE_EXPERIMENT",
        },
        { status: 200 }
      );
    }

    // 2) If lock exists and not expired => return locked winner
    const { lock, error: lockErr } = await getExistingLock(supabase, page);
    if (lockErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to read lock", detail: lockErr },
        { status: 500 }
      );
    }

    if (lock && !lockIsExpired(lock)) {
      const lockedWinner =
        lock?.winner || lock?.variant || lock?.cta_variant || null;

      return NextResponse.json(
        {
          ok: true,
          page,
          test_id: exp.test_id,
          has_active_experiment: true,
          winner_locked: true,
          winner: lockedWinner,
          lock,
          policy: exp,
        },
        { status: 200 }
      );
    }

    // 3) No valid lock => compute from metrics
    const { rows, error: mErr } = await readMetrics(
      supabase,
      page,
      exp.variants,
      true
    );
    if (mErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to read metrics", detail: mErr },
        { status: 500 }
      );
    }

    const decision = pickWinner(
      rows,
      exp.min_enters_per_variant,
      exp.min_abs_lift
    );

    if (!decision.ok || !decision.winner) {
      return NextResponse.json(
        {
          ok: true,
          page,
          test_id: exp.test_id,
          has_active_experiment: true,
          winner_locked: false,
          winner: null,
          reason: decision.reason,
          policy: exp,
          metrics: rows,
          debug: decision.debug,
        },
        { status: 200 }
      );
    }

    // 4) Winner selected. If lock enabled, write lock (ttl null => indefinite)
    let lockWrite: any = null;
    if (exp.lock_enabled) {
      const res = await writeLock(supabase, {
        page,
        test_id: exp.test_id,
        winner: decision.winner,
        reason: "AUTOLOCK_WINNER",
        lock_ttl_hours: exp.lock_ttl_hours,
        meta: {
          policy: {
            min_enters_per_variant: exp.min_enters_per_variant,
            min_abs_lift: exp.min_abs_lift,
          },
          decision_debug: decision.debug,
          metrics: rows,
        },
      });
      lockWrite = res;
    }

    return NextResponse.json(
      {
        ok: true,
        page,
        test_id: exp.test_id,
        has_active_experiment: true,
        winner_locked: Boolean(exp.lock_enabled),
        winner: decision.winner,
        reason: decision.reason,
        policy: exp,
        metrics: rows,
        lock_write: lockWrite,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}