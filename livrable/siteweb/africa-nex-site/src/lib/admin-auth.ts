import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function checkAdmin(request: Request): NextResponse | null {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD non configure" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || !safeCompare(token, pwd)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  return null;
}
