import "server-only";
import { after } from "next/server";
import { createTranslator } from "next-intl";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail } from "./template";

// Emails de notification (20 novembre 2026). Envoyes APRES la reponse (after) : une action n'est
// jamais ralentie ni bloquee par l'envoi. Chaque email est journalise dans email_notifications.
//
// Modes (variables d'environnement) :
//   EMAIL_DELIVERY=resend + RESEND_API_KEY : envoi reel (production) ;
//   EMAIL_REDIRECT_TO=adresse            : en plus, tout part vers cette adresse (tests d'Adlene) ;
//   sinon                                 : mode journal, rien ne part (developpement, tests).
// Les comptes de test (@example.com) ne recoivent jamais rien.
//
// Confidentialite : un email ne contient ni le nom de l'acheteur (producteur), ni celui d'un
// producteur (acheteur), ni le texte des messages ; seulement un lien vers l'espace.

type Locale = "fr" | "en" | "ar";
type Values = Record<string, string | number>;

export type NotifyKind =
  | "new_request"      // producteur : nouvelle demande de devis (brief)
  | "offer_ready"      // acheteur : une offre est publiee
  | "new_message"      // acheteur ou producteur : message d'AFRICA NEX
  | "admin_new_rfq"    // AFRICA NEX : nouvelle demande d'un acheteur
  | "admin_new_quote"  // AFRICA NEX : devis recu d'un producteur
  | "admin_decision"   // AFRICA NEX : decision de l'acheteur sur une offre
  | "admin_new_message" // AFRICA NEX : message d'un acheteur ou d'un producteur
  | "admin_deletion_request"; // AFRICA NEX : demande de suppression de compte

type Recipient = { profileId: string | null; email: string | null; locale: Locale; name: string | null };
type Spec = { kind: NotifyKind; rfqId?: string | null; path: string; values: Values; rows?: [string, string][]; variant?: string };

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FROM = process.env.EMAIL_FROM ?? "AFRICA NEX <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.CONTACT_EMAIL ?? "sarlafricanex@gmail.com";
const isLocale = (l: unknown): l is Locale => l === "fr" || l === "en" || l === "ar";

async function translator(locale: Locale) {
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return createTranslator({ locale, messages, namespace: "email" });
}

// Destinataires : profils (langue et email), ou membres d'une entreprise (producteur).
async function profilesOf(ids: string[]): Promise<Recipient[]> {
  if (!ids.length) return [];
  const { data } = await createAdminClient().from("profiles").select("id, email, locale, full_name").in("id", ids);
  return (data ?? []).map((p) => ({ profileId: p.id, email: p.email, locale: isLocale(p.locale) ? p.locale : "fr", name: p.full_name }));
}
async function membersOf(companyId: string): Promise<Recipient[]> {
  const { data } = await createAdminClient().from("company_members").select("profile_id").eq("company_id", companyId);
  return profilesOf((data ?? []).map((m) => m.profile_id));
}

async function deliver(to: Recipient, spec: Spec) {
  const t = await translator(to.locale);
  const k = spec.variant ? `${spec.kind}_${spec.variant}` : spec.kind;
  const subject = t(`${k}_subject`, spec.values);
  const firstName = to.name?.trim().split(/\s+/)[0];
  const { html, text } = renderEmail({
    locale: to.locale,
    preheader: t(`${k}_intro`, spec.values),
    title: t(`${k}_title`, spec.values),
    greeting: firstName ? t("greeting", { name: firstName }) : t("greetingNoName"),
    paragraphs: [t(`${k}_intro`, spec.values), ...(t.has(`${k}_note`) ? [t(`${k}_note`, spec.values)] : [])],
    rows: spec.rows?.map(([label, value]) => ({ label: t(label), value })),
    cta: { label: t.has(`${k}_cta`) ? t(`${k}_cta`) : t(`${spec.kind}_cta`), url: `${SITE_URL}/${spec.path.startsWith("/admin") ? "fr" : to.locale}${spec.path}` },
    footer: t(spec.kind.startsWith("admin_") ? "footerAdmin" : "footer"),
  });

  const log = { kind: spec.kind, rfq_id: spec.rfqId ?? null, recipient_profile_id: to.profileId, recipient_email: to.email, locale: to.locale, subject: subject.slice(0, 300) };
  const record = (status: "sent" | "redirected" | "logged" | "skipped" | "failed", error?: string) =>
    createAdminClient().from("email_notifications").insert({ ...log, status, error: error?.slice(0, 500) ?? null });

  if (!to.email || /@example\.com$/i.test(to.email)) return record("skipped");
  const key = process.env.RESEND_API_KEY;
  if (process.env.EMAIL_DELIVERY !== "resend" || !key) return record("logged");
  const redirect = process.env.EMAIL_REDIRECT_TO;
  try {
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to: redirect || to.email,
      subject: redirect ? `[test : ${to.email}] ${subject}` : subject,
      html,
      text,
    });
    if (error) return record("failed", error.message);
    return record(redirect ? "redirected" : "sent");
  } catch (e) {
    return record("failed", e instanceof Error ? e.message : String(e));
  }
}

// Planifie l'envoi apres la reponse ; une erreur n'interrompt jamais l'action.
function schedule(resolve: () => Promise<Recipient[]>, spec: Spec) {
  after(async () => {
    try {
      const recipients = await resolve();
      for (const r of recipients) await deliver(r, spec);
    } catch (e) {
      console.error("Notification failed:", spec.kind, e instanceof Error ? e.message : e);
    }
  });
}

export const notify = {
  // Producteur : toutes les personnes de l'entreprise (une fiche non revendiquee n'a personne).
  company: (companyId: string, spec: Spec) => schedule(() => membersOf(companyId), spec),
  // Acheteur ou personne precise.
  profile: (profileId: string, spec: Spec) => schedule(() => profilesOf([profileId]), spec),
  // AFRICA NEX : adresse de contact, toujours en francais.
  admin: (spec: Spec) => schedule(async () => [{ profileId: null, email: ADMIN_EMAIL, locale: "fr", name: null }], spec),
};
