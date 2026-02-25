"use client";

import { useEffect } from "react";

export default function FatiguePage() {
  useEffect(() => {
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "fatigue",
        action: "enter_page",
      }),
    });
  }, []);

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
      <h1>😵 피로 건강 페이지</h1>
      <p>요즘 쉽게 피로해지시나요? 피로 상태를 확인해보세요.</p>
    </main>
  );
}