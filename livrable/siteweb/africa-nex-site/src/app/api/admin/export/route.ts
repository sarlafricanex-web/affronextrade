import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { getSubmissions } from "@/lib/db";

export async function GET(request: Request) {
  const denied = checkAdmin(request);
  if (denied) return denied;

  try {
    const rows = await getSubmissions(10000, 0);

    const headers = ["ID", "Date", "Nom", "Email", "Entreprise", "Pays", "Telephone", "WhatsApp", "Message"];
    const csvRows = [headers.join(";")];

    for (const r of rows) {
      csvRows.push(
        [
          r.id,
          new Date(r.created_at).toLocaleString("fr-FR"),
          csvEscape(r.name),
          csvEscape(r.email),
          csvEscape(r.company),
          csvEscape(r.country),
          csvEscape(r.phone),
          csvEscape(r.whatsapp),
          csvEscape(r.message),
        ].join(";")
      );
    }

    const bom = "﻿";
    const csv = bom + csvRows.join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-africanex-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur export", detail: String(e) },
      { status: 500 }
    );
  }
}

function csvEscape(val: unknown): string {
  let s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("'")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
