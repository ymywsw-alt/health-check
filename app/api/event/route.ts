import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// enter_page = 10s bucket, click/complete = 1s bucket
function bucketTimeMs(eventName: string) {
  if (eventName === "enter_page") return 10_000;
  // click_* and complete_funnel and others -> 1s
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
    const body = await req.json();

    const sid = String(body?.sid ?? body?.session_id ?? "");
    const page = String(body?.page ?? "");
    const event_name = String(body?.event_name ?? "");
    const variant = body?.variant != null ? String(body.variant) : null;
    const is_test = !!body?.is_test;

    if (!sid || !page || !event_name) {
      return NextResponse.json(
        { ok: false, error: "missing required fields: sid, page, event_name" },
        { status: 400 }
      );
    }

    // timestamp: client may send ts; otherwise server now
    const rawTs = body?.ts ? new Date(body.ts) : new Date();
    const safeTs = isNaN(rawTs.getTime()) ? new Date() : rawTs;

    const bucketMs = bucketTimeMs(event_name);
    const bucket_iso = floorToBucketISO(safeTs, bucketMs);

    // ✅ dedup_key (SHA1)
    // 중복 제거 기준: (sid, page, event_name, variant, is_test, bucket_iso)
    const dedup_key = sha1(
      [sid, page, event_name, variant ?? "", is_test ? "1" : "0", bucket_iso].join("|")
    );

    const ua = req.headers.get("user-agent") ?? null;

    // meta는 jsonb로 안전하게
    const meta = (body?.meta && typeof body.meta === "object") ? body.meta : {};

    // ✅ 저장 (중복은 DB unique(dedup_key) + upsert/ignore로 제거)
    // - 테이블: funnel_events_v1
    // - 컬럼은 아래 이름을 기준으로 설계된 상태를 전제(네 BASELINE 설명과 일치)
    const row = {
      sid,
      page,
      event_name,
      variant,
      is_test,
      bucket_iso,
      dedup_key,
      meta,
      ua,
      occurred_at: bucket_iso, // 분석용 (버킷 기준)
      created_at: new Date().toISOString(),
    };

    // onConflict는 supabase-js에서 upsert로 처리
    // dedup_key가 unique라면 중복은 업데이트 없이 사실상 "1건 유지"가 됨
    const { error } = await supabase
      .from("funnel_events_v1")
      .upsert(row, { onConflict: "dedup_key", ignoreDuplicates: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "insert_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      dedup_key,
      bucket_iso,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}