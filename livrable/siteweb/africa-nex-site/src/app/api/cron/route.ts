import { NextResponse } from "next/server";
import { purgeOldSubmissions, countSubmissions } from "@/lib/data/submissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeCompare } from "@/lib/safe-compare";
import { Resend } from "resend";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  // Tache sans utilisateur connecte : seule la cle secrete peut purger et compter.
  const admin = createAdminClient();
  const results: Record<string, unknown> = {};

  try {
    const purged = await purgeOldSubmissions(admin);
    results.purged = purged;
  } catch (e) {
    console.error("Cron purge error:", e);
    results.purgeError = true;
  }

  try {
    const total = await countSubmissions(admin);
    results.totalSubmissions = total;
  } catch (e) {
    console.error("Cron count error:", e);
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const to = process.env.CONTACT_EMAIL ?? "sarlafricanex@gmail.com";
    try {
      await resend.emails.send({
        from: "AFRICA NEX Cron <onboarding@resend.dev>",
        to,
        subject: "Rapport hebdomadaire - AFRICA NEX",
        html: `
          <h2>Rapport hebdomadaire</h2>
          <p><strong>Contacts en base :</strong> ${results.totalSubmissions ?? "N/A"}</p>
          <p><strong>Anciens contacts supprimes :</strong> ${results.purged ?? 0}</p>
          <p style="color:#888;font-size:12px;">Sauvegardes : quotidiennes (Supabase)</p>
          <p style="color:#888;font-size:12px;">Exporte tes contacts depuis le <a href="https://affronextrade.vercel.app/fr/admin">dashboard admin</a></p>
        `,
      });
      results.emailSent = true;
    } catch (e) {
      console.error("Cron email error:", e);
    }
  }

  return NextResponse.json({ success: true, ...results });
}
