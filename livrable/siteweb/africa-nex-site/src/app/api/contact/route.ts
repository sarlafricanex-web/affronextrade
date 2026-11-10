import { NextResponse } from "next/server";
import { Resend } from "resend";
import { saveSubmission } from "@/lib/data/submissions";
import { isValidPhone } from "@/lib/phone";
import { countryName, isCountryCode } from "@/lib/countries";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NOTIFY_EMAIL = process.env.CONTACT_EMAIL ?? "sarlafricanex@gmail.com";

export async function POST(request: Request) {
  let data: Record<string, string>;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, company, country, phone, whatsapp, message } = data;

  if (!name || !email) {
    return NextResponse.json({ error: "Nom et email requis" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  // Meme regle que le formulaire : vide, ou numero international valide (+213555123456).
  if (!isValidPhone(phone) || !isValidPhone(whatsapp)) {
    return NextResponse.json({ error: "Numero de telephone invalide" }, { status: 400 });
  }

  // Code pays ISO ("SN") choisi dans la liste : fiable pour les statistiques.
  if (!isCountryCode(country)) {
    return NextResponse.json({ error: "Pays invalide" }, { status: 400 });
  }

  // Store in database
  let saved = false;
  try {
    const row = await saveSubmission({ name, email, company, country, phone, whatsapp, message });
    if (row) saved = true;
  } catch (e) {
    console.error("DB save failed:", e);
  }

  // Send email notification
  let emailed = false;
  if (resend) {
    try {
      await resend.emails.send({
        from: "AFRICA NEX Contact <onboarding@resend.dev>",
        to: NOTIFY_EMAIL,
        subject: `Nouveau contact : ${name}${company ? ` (${company})` : ""}`,
        html: `
          <h2>Nouveau message depuis le site AFRICA NEX</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:6px 12px;font-weight:bold;">Nom</td><td style="padding:6px 12px;">${esc(name)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
            ${company ? `<tr><td style="padding:6px 12px;font-weight:bold;">Entreprise</td><td style="padding:6px 12px;">${esc(company)}</td></tr>` : ""}
            ${country ? `<tr><td style="padding:6px 12px;font-weight:bold;">Pays</td><td style="padding:6px 12px;">${esc(countryName(country) ?? country)}</td></tr>` : ""}
            ${phone ? `<tr><td style="padding:6px 12px;font-weight:bold;">Telephone</td><td style="padding:6px 12px;">${esc(phone)}</td></tr>` : ""}
            ${whatsapp ? `<tr><td style="padding:6px 12px;font-weight:bold;">WhatsApp</td><td style="padding:6px 12px;">${esc(whatsapp)}</td></tr>` : ""}
          </table>
          ${message ? `<h3 style="margin-top:20px;">Message</h3><p style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:4px;">${esc(message)}</p>` : ""}
          <hr style="margin-top:24px;border:none;border-top:1px solid #ddd;">
          <p style="color:#888;font-size:12px;">Soumis depuis le site AFRICA NEX${saved ? " - Enregistre en base" : ""}</p>
        `,
      });
      emailed = true;
    } catch (e) {
      console.error("Email send failed:", e);
    }
  }

  if (!saved && !emailed) {
    console.error("Submission lost - no DB, no email:", data);
    return NextResponse.json(
      { error: "Service temporairement indisponible" },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, saved, emailed });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
