"use client";

import { useEffect, useState } from "react";

export default function SleepPage() {
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

  // ✅ winner 로드 → enter_page(세션당 1회) 기록 (variant 포함)
  useEffect(() => {
    if (!sessionId) return;

    const path = window.location.pathname;
    const enterKey = `hc_entered:${sessionId}:${path}`;

    (async () => {
      let v: "cta_v1" | "cta_v2" = "cta_v1";

      try {
        const res = await fetch(
          `/api/cta-winner?page=sleep&sid=${sessionId}`,
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
            category: "sleep",
            action: "enter_page",
            variant: v,
            session_id: sessionId,
            is_test: isTest,
          }),
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
          category: "sleep",
          action: "click_joint_cta",
          variant: ctaWinner,
          session_id: sessionId,
          is_test: isTest,
        }),
      });
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        // ✅ 테스트 모드면 다음 페이지도 ?t=1 유지
        window.location.href = isTest ? "/joint?t=1" : "/joint";
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
      <h1>😴 수면 건강 페이지</h1>
      <p>밤에 자주 깨시나요? 수면 상태를 확인해보세요.</p>

      <button
        onClick={clickThenGo}
        style={{
          marginTop: 18,
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
          ? "👉 관절 상태도 함께 확인하기"
          : "👉 10초만 더! 관절 체크하고 다음으로"}
      </button>

      <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
        (클릭 흐름이 DB 전환률에 반영됩니다)
      </div>

      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 11 }}>
        CTA winner: {ctaWinner}
      </div>
    </main>
  );
}