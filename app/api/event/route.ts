import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ✅ IMPORTANT:
// - Do NOT create Supabase client at module scope (build-time eval can fail).
// - Create it inside the handler so env is read at request-time.
function supabaseServer() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!url) throw new Error("Missing SUPABASE URL env");
  if (!key) throw new Error("Missing SUPABASE KEY env");

  return createClient(url, key, { auth: { persistSession: false } });
}

// enter_page = 10s bucket, click/complete = 1s bucket
function bucketTimeMs(eventName: string) {
  if (eventName === "enter_page") return 10_000;
  return 1_000;
}

function floorToBucketISO(ts: Date, bucketMs: number) {
  const t = ts.getTime();
  const floored = Math.floor(t / bucketMs) * bucketMs;
  return new Date(floored).toISOString();
}

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseServer();

    const body = await req.json();

    const sid = String(body?.sid ?? body?.session_id ?? "");
    const page = String(body?.page ?? body?.category ?? "");
const event_name = String(body?.event_name ?? body?.action ?? "");
    const variant = body?.variant != null ? String(body.variant) : null;
    const is_test = !!body?.is_test;

    // minimal validation
    if (!sid || !page || !event_name) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: sid/page/event_name" },
        { status: 400 }
      );
    }

    // bucket + dedup (baseline behavior)
    const ts = body?.ts ? new Date(body.ts) : new Date();
    const bucket_iso = floorToBucketISO(ts, bucketTimeMs(event_name));

    const dedup_key = sha1(
      [
        sid,
        page,
        event_name,
        variant ?? "",
        is_test ? "1" : "0",
        bucket_iso,
      ].join("|")
    );

    // Insert to funnel_events_v1
    const payload = {
      sid,
      page,
      event_name,
      variant,
      is_test,
      bucket_iso: ts.toISOString(),
      dedup_key,
      meta: body?.meta ?? null,
      ua: body?.ua ?? null,
    };

    const { error } = await supabase
      .from("funnel_events_v1")
      .insert(payload);

    // If dedup_key is unique and we hit conflict, treat as ok (idempotent)
    if (error) {
      const msg = String(error.message || "");
      const isDup =
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique");

      if (!isDup) {
        return NextResponse.json(
          { ok: false, error: "DB insert failed", detail: error },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}