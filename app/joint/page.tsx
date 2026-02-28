"use client";

import { useEffect, useState } from "react";

export default function JointPage() {
  const [ctaWinner, setCtaWinner] = useState<"cta_v1" | "cta_v2">("cta_v1");
  const [sessionId, setSessionId] = useState<string>("");

  // ✅ 테스트 트래픽 스위치 (?t=1)
  const isTest =
    typeof window !== "undefined" &&
    window.location.search.includes("t=1");

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
          `/api/cta-winner?page=joint&sid=${sessionId}`,
          { cache: "no-store" }
        );
        const json: any = await res.json();
        v = json?.variant === "cta_v2" ? "cta_v2" : "cta_v1";
      } catch {
        v = "cta_v1";
      }

      setCtaWinner(v);

      // ✅ 세션당 1회 enter_page 기록 + variant 포함 + is_test 포함
      if (!sessionStorage.getItem(enterKey)) {
        sessionStorage.setItem(enterKey, "1");

        fetch("/api/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
  page: "joint",
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
  page: "joint",
  event_name: "click_fatigue_cta",
  variant: ctaWinner,
  sid: sessionId,
  is_test: isTest,
})
      });
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        window.location.href = isTest ? "/fatigue?t=1" : "/fatigue";
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
        gap: "14px",
        padding: "24px",
      }}
    >
      <h1>🦴 관절 건강 페이지</h1>
      <p style={{ margin: 0 }}>관절 상태를 확인해보세요.</p>

      <button
        onClick={clickThenGo}
        style={{
          marginTop: 10,
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
        {ctaWinner === "cta_v1"
          ? "👉 피로 상태도 함께 확인하기"
          : "👉 10초만 더! 피로 체크하고 끝내기"}
      </button>

      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
        (버튼 클릭 → 다음 단계로 바로 이동합니다)
      </div>

      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 11 }}>
        CTA winner: {ctaWinner}
      </div>
    </main>
  );
}