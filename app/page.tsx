import Link from "next/link";
export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
        textAlign: "center",
        gap: "20px",
      }}
    >
      <h1 style={{ fontSize: "32px", fontWeight: "700" }}>
        오늘 건강 상태는 어떠세요?
      </h1>

      <div style={{ display: "grid", gap: "12px", width: "220px" }}>
  <Link href="/sleep">
    <button>😴 수면</button>
  </Link>

  <Link href="/joint">
    <button>🦵 관절</button>
  </Link>

  <Link href="/fatigue">
    <button>⚡ 피로</button>
  </Link>

  <Link href="/bp">
    <button>❤️ 혈압</button>
  </Link>
      </div>
    </main>
  );
}