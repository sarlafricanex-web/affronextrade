// Emails de notification dans les tests : ils sont journalises dans email_notifications juste
// APRES la reponse (after), donc on attend leur apparition. En developpement (sans
// EMAIL_DELIVERY=resend), rien ne part : statut "logged", ou "skipped" pour les comptes @example.com.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitEmails(admin, filter, { count = 1, tries = 25 } = {}) {
  let rows = [];
  for (let i = 0; i < tries; i++) {
    let q = admin.from("email_notifications").select("kind, rfq_id, recipient_profile_id, recipient_email, locale, subject, status, error").order("created_at");
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    rows = (await q).data ?? [];
    if (rows.length >= count) return rows;
    await sleep(400);
  }
  return rows;
}

// Un email n'a jamais echoue (Resend) : journalise, ignore (compte de test) ou envoye.
export const delivered = (rows) => rows.every((r) => ["logged", "skipped", "sent", "redirected"].includes(r.status));
