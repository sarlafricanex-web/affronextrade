import { NextResponse } from "next/server";

export function checkAdmin(request: Request): NextResponse | null {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD non configure" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${pwd}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  return null;
}
