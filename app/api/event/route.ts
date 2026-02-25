import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const event = {
    timestamp: new Date().toISOString(),
    ...body,
  };

  console.log("HEALTH_EVENT:", event);

  return NextResponse.json({ ok: true });
}