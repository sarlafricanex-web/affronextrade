import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { initDb } from "@/lib/db";

export async function POST(request: Request) {
  const denied = checkAdmin(request);
  if (denied) return denied;

  try {
    const ok = await initDb();
    if (!ok) {
      return NextResponse.json(
        { error: "DATABASE_URL non configure" },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, message: "Table submissions creee" });
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur DB", detail: String(e) },
      { status: 500 }
    );
  }
}
