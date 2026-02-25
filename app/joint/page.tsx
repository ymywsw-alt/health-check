"use client";

import { useEffect } from "react";

export default function JointPage() {
  useEffect(() => {
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "joint", action: "enter_page" }),
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
      <h1>🦴 관절 건강 페이지</h1>
      <p>무릎/허리 통증이 있으신가요? 관절 상태를 확인해보세요.</p>
    </main>
  );
}