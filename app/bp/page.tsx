"use client";

import { useEffect, useState } from "react";

export default function BPPage() {
  const [ctaWinner, setCtaWinner] = useState<"cta_v1" | "cta_v2">("cta_v1");
  const [sessionId, setSessionId] = useState<string>("");

  // ✅ 테스트 트래픽 감지 (?t=1)
  const isTest =
    typeof window !== "undefined" &&
    window.location.search.includes("t=1");

  // ✅ session_id 유지
  useEffect(() => {
    const key = "hc_session_id";
    let sid = localStorage.getItem(key);

    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(key, sid);
    }

    setSessionId(sid);
  }, []);

  // ✅ winner 로드 → enter_page(세션당 1회) 기록
  useEffect(() => {
    if (!sessionId) return;

    const path = window.location.pathname;
    const enterKey = `hc_entered:${sessionId}:${path}`;

    (async () => {
      let v: "cta_v1" | "cta_v2" = "cta_v1";

      try {
        const res = await fetch(
          `/api/cta-winner?page=bp&sid=${sessionId}`,
          { cache: "no-store" }
        );
        const json: any = await res.json();
        v = json?.variant === "cta_v2" ? "cta_v2" : "cta_v1";
      } catch {
        v = "cta_v1";
      }

      setCtaWinner(v);

      if (!sessionStorage.getItem(enterKey)) {
        sessionStorage.setItem(enterKey, "1");

        fetch("/api/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
  page: "bp",
  event_name: "enter_page",
  variant: v,
  sid: sessionId,
  is_test: isTest,
})
        }).catch(() => {});
      }
    })();
  }, [sessionId, isTest]);

  const complete = async () => {
    if (!sessionId) return;

    try {
      await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  page: "bp",
  event_name: "click_complete_cta",
  variant: ctaWinner,
  sid: sessionId,
  is_test: isTest,
})
      });
    } catch {
      // ignore
    } finally {
      alert("✅ 완료! 기록이 저장되었습니다.");
    }
  };

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
        gap: "16px",
        padding: "24px",
      }}
    >
      <h1>🩺 혈압 건강 페이지</h1>
      <p>혈압 상태를 확인해보세요.</p>

      <button
        onClick={complete}
        style={{
          marginTop: 12,
          padding: "14px 24px",
          background: "#111",
          color: "#fff",
          borderRadius: 10,
          fontWeight: "bold",
          display: "inline-block",
          border: "none",
          cursor: "pointer",
        }}
      >
        ✅ 오늘 체크 완료하기
      </button>

      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
        (완료 버튼을 누르면 퍼널 완주가 기록됩니다)
      </div>

      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 11 }}>
        CTA winner: {ctaWinner}
      </div>
    </main>
  );
}