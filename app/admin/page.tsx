import { createClient } from "@supabase/supabase-js";

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

export default async function AdminPage() {
  const supabase = supabaseServer();

  // ✅ 아래는 기존 AdminPage 로직을 유지하기 위한 최소 예시
  // 너 프로젝트에서 여기 아래에 이미 있던 조회/렌더 로직이 있으면 그대로 두면 됨.
  // (중요: supabase 생성만 함수 안으로 들어오면 빌드가 통과함)
  const { data: locks, error } = await supabase
    .from("cta_winner_locks_v1")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admin</h1>

      <div style={{ marginTop: 12, opacity: 0.8 }}>
        {error ? (
          <div style={{ color: "crimson" }}>
            Error: {String((error as any)?.message || error)}
          </div>
        ) : (
          <div>Loaded {locks?.length ?? 0} rows from cta_winner_locks_v1</div>
        )}
      </div>

      <pre
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(0,0,0,0.02)",
          overflowX: "auto",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {JSON.stringify(locks ?? [], null, 2)}
      </pre>
    </main>
  );
}