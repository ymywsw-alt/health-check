import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function AdminPage() {
  // ✅ redirect() 없이 렌더로 차단 (Pages/App 혼선에서도 안전)
  const k = process.env.NEXT_PUBLIC_ADMIN_KEY;
  if (!k) {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>🚫 Not allowed</h1>
        <p>ADMIN_KEY is missing.</p>
        <p style={{ color: "#6b7280", fontSize: 12 }}>
          Set <b>NEXT_PUBLIC_ADMIN_KEY</b> to enable /admin.
        </p>
      </main>
    );
  }

  // 기존 대시보드(유지)
  const { data: dash } = await supabase
    .from("healthcheck_dashboard_v1")
    .select("*");

  // 퍼널 메트릭(추가)
  const { data: fmRaw } = await supabase
    .from("funnel_health_metrics_v1")
    .select("*")
    .maybeSingle();

  // 자동 추천(추가)
  const { data: rec } = await supabase
    .from("ux_action_recommendation_v2")
    .select("*")
    .maybeSingle();

  // ✅ fm이 null이어도 절대 안 터지게 가드
  const fm = fmRaw ?? {
    sleep_sessions: 0,
    joint_sessions: 0,
    fatigue_sessions: 0,
    bp_sessions: 0,
    complete_sessions: 0,
    sleep_to_joint_rate: 0,
    joint_to_fatigue_rate: 0,
    fatigue_to_bp_rate: 0,
    complete_rate: 0,
  };

  const pct = (x: any) => {
    const n = typeof x === "number" ? x : Number(x);
    if (!isFinite(n)) return "-";
    return `${(n * 100).toFixed(1)}%`;
  };

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>📊 Health-Check Dashboard</h1>

      {/* ✅ Funnel Metrics 카드 */}
      <div
        style={{
          marginTop: 20,
          padding: 20,
          border: "2px solid #111",
          borderRadius: 12,
          background: "#fafafa",
        }}
      >
        <h2 style={{ marginTop: 0 }}>🧭 Funnel Metrics</h2>

        <div style={{ display: "grid", gap: 6 }}>
          <p style={{ margin: 0 }}>
            <b>Sessions:</b>{" "}
            Sleep {fm.sleep_sessions} → Joint {fm.joint_sessions} → Fatigue{" "}
            {fm.fatigue_sessions} → BP {fm.bp_sessions} → Complete{" "}
            {fm.complete_sessions}
          </p>

          <p style={{ margin: 0 }}>
            <b>Sleep → Joint:</b> {pct(fm.sleep_to_joint_rate)}
          </p>
          <p style={{ margin: 0 }}>
            <b>Joint → Fatigue:</b> {pct(fm.joint_to_fatigue_rate)}
          </p>
          <p style={{ margin: 0 }}>
            <b>Fatigue → BP:</b> {pct(fm.fatigue_to_bp_rate)}
          </p>
          <p style={{ margin: 0 }}>
            <b>Complete Rate (from Sleep):</b> {pct(fm.complete_rate)}
          </p>
        </div>

        <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
          (DB view: funnel_health_metrics_v1)
        </div>

        {/* ✅ Action Recommendation (v2) 카드 */}
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800 }}>
            ✅ Action Recommendation (v2) — Priority:{" "}
            {rec?.priority_level ?? "-"}
          </div>
          <div style={{ marginTop: 8, color: "#111" }}>
            {rec?.recommendation ?? "-"}
          </div>
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
            (DB view: ux_action_recommendation_v2)
          </div>
        </div>
      </div>

      {/* ✅ 기존 Dashboard 카드 유지 */}
      {dash?.map((row, i) => (
        <div
          key={i}
          style={{
            marginTop: 20,
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <p>
            <b>Sleep Visits:</b> {row.step_sleep}
          </p>
          <p>
            <b>Joint Visits:</b> {row.step_joint}
          </p>
          <p>
            <b>Fatigue Visits:</b> {row.step_fatigue}
          </p>

          <p>
            <b>Sleep → Joint:</b> {row.sleep_to_joint_rate}
          </p>
          <p>
            <b>Joint → Fatigue:</b> {row.joint_to_fatigue_rate}
          </p>

          <p>
            <b>Top Drop-off Page:</b> {row.top_dropoff_page} (
            {row.top_dropoff_sessions})
          </p>
          <p>
            <b>Priority:</b> {row.priority_level}
          </p>

          <p style={{ color: "crimson", fontWeight: "bold" }}>
            👉 {row.recommendation}
          </p>
        </div>
      ))}
    </main>
  );
}