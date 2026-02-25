"use client";

import { useEffect } from "react";

export default function BpPage() {
  useEffect(() => {
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "bp",
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
      <h1>🩸 혈압 건강 페이지</h1>
      <p>혈압이 걱정되시나요? 혈압 상태를 확인해보세요.</p>
    </main>
  );
}