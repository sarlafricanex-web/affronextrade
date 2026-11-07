import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { getSubmissions, countSubmissions } from "@/lib/db";

export async function GET(request: Request) {
  const denied = checkAdmin(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const [rows, total] = await Promise.all([
      getSubmissions(limit, offset),
      countSubmissions(),
    ]);
    return NextResponse.json({ submissions: rows, total, limit, offset });
  } catch (e) {
    console.error("Admin submissions error:", e);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}
