import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { getAllSubmissions } from "@/lib/data/submissions";
import ExcelJS from "exceljs";

export async function GET(request: Request) {
  const denied = checkAdmin(request);
  if (denied) return denied;

  try {
    const rows = await getAllSubmissions();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AFRICA NEX";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Contacts");

    sheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Date", key: "date", width: 18 },
      { header: "Nom", key: "name", width: 22 },
      { header: "Email", key: "email", width: 28 },
      { header: "Entreprise", key: "company", width: 22 },
      { header: "Pays", key: "country", width: 16 },
      { header: "Telephone", key: "phone", width: 18 },
      { header: "WhatsApp", key: "whatsapp", width: 18 },
      { header: "Message", key: "message", width: 40 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 28;

    for (const r of rows) {
      const val = sanitize(r.message);
      sheet.addRow({
        id: r.id,
        date: new Date(r.created_at).toLocaleString("fr-FR"),
        name: sanitize(r.name),
        email: sanitize(r.email),
        company: sanitize(r.company),
        country: sanitize(r.country),
        phone: sanitize(r.phone),
        whatsapp: sanitize(r.whatsapp),
        message: val,
      });
    }

    sheet.eachRow((row, num) => {
      if (num === 1) return;
      row.alignment = { vertical: "top", wrapText: true };
      if (num % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      }
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 9 },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="contacts-africanex-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Admin export error:", e);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}

function sanitize(val: unknown): string {
  const s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}
