"use client";

import { useEffect } from "react";

export default function SleepPage() {

  useEffect(() => {
    fetch("/api/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: "sleep",
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
      <h1>😴 수면 건강 페이지</h1>
      <p>밤에 자주 깨시나요? 수면 상태를 확인해보세요.</p>
    </main>
  );
}