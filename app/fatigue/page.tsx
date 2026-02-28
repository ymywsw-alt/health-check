"use client";

import { useEffect, useState } from "react";

export default function FatiguePage() {
  const [ctaWinner, setCtaWinner] = useState<"cta_v1" | "cta_v2">("cta_v1");
  const [sessionId, setSessionId] = useState<string>("");

  // ✅ 테스트 트래픽 스위치 (?t=1)
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

  // ✅ winner 로드 → enter_page(세션당 1회) 기록 (winner 포함)
  useEffect(() => {
    if (!sessionId) return;

    const path = window.location.pathname;
    const enterKey = `hc_entered:${sessionId}:${path}`;

    (async () => {
      let v: "cta_v1" | "cta_v2" = "cta_v1";

      try {
        const res = await fetch(
          `/api/cta-winner?page=fatigue&sid=${sessionId}`,
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
  page: "fatigue",
  event_name: "enter_page",
  variant: v,
  sid: sessionId,
  is_test: isTest,
})
        }).catch(() => {});
      }
    })();
  }, [sessionId, isTest]);

  const clickThenGo = async () => {
    if (!sessionId) return;

    try {
      await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  page: "fatigue",
  event_name: "click_bp_cta",
  variant: ctaWinner,
  sid: sessionId,
  is_test: isTest,
})
      });
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        window.location.href = isTest ? "/bp?t=1" : "/bp";
      }, 150);
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
      <h1>😵 피로 건강 페이지</h1>
      <p>요즘 쉽게 피로해지시나요? 피로 상태를 확인해보세요.</p>

      <button
        onClick={clickThenGo}
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
        👉 혈압 상태도 함께 확인하기
      </button>

      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
        (클릭 흐름이 DB 전환률에 반영됩니다)
      </div>

      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 11 }}>
        CTA winner: {ctaWinner}
      </div>
    </main>
  );
}