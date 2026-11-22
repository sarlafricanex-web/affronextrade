import { getFormatter, getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { cancelAccountDeletion, requestAccountDeletion } from "@/app/[locale]/(app)/account-actions";
import { Link } from "@/i18n/navigation";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const NOTICES = ["requested", "cancelled", "error", "confirm"] as const;

// Encart "Supprimer mon compte" (bas de "Mon entreprise"), pour les producteurs et les acheteurs.
export async function AccountDeletion({ locale, supabase, notice }: { locale: string; supabase: SupabaseClient<Database>; notice?: string }) {
  const [t, format, { data: pending }] = await Promise.all([
    getTranslations({ locale, namespace: "account" }),
    getFormatter({ locale }),
    supabase.from("account_deletion_requests").select("created_at").eq("status", "pending").maybeSingle(),
  ]);
  const shown = NOTICES.find((n) => n === notice);

  return (
    <section id="account-deletion" className="flex flex-col gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}`, borderInlineStart: "4px solid #b91c1c" }} data-account-deletion={pending ? "pending" : "none"}>
      <h2 className="text-xs font-bold uppercase" style={caps}>{t("deletionTitle")}</h2>
      {shown && (
        <p role={shown === "requested" || shown === "cancelled" ? "status" : "alert"} className="text-sm font-semibold" style={{ color: shown === "error" || shown === "confirm" ? "#b91c1c" : "#065f46" }}>
          {t(`deletionNotice_${shown}`)}
        </p>
      )}
      {pending ? (
        <form action={cancelAccountDeletion} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <p className="text-sm">{t("deletionPending", { date: format.dateTime(new Date(pending.created_at), { dateStyle: "long" }) })}</p>
          <button type="submit" className="w-fit px-5 py-2.5 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>{t("deletionCancel")}</button>
        </form>
      ) : (
        <details>
          <summary className="cursor-pointer text-sm font-semibold" style={{ color: "#b91c1c" }}>{t("deletionOpen")}</summary>
          <form action={requestAccountDeletion} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="locale" value={locale} />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {t("deletionText")}{" "}
              <Link href="/privacy" className="underline">{t("deletionPolicy")}</Link>
            </p>
            <label htmlFor="deletion-reason" className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("deletionReason")}</label>
            <textarea id="deletion-reason" name="reason" rows={3} maxLength={1000} className="w-full px-3 py-2 text-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)" }} />
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="confirm" required className="mt-1" />
              <span>{t("deletionConfirm")}</span>
            </label>
            <button type="submit" className="w-fit px-5 py-2.5 text-xs font-bold uppercase" style={{ ...caps, background: "#b91c1c", color: "white" }}>{t("deletionSubmit")}</button>
          </form>
        </details>
      )}
    </section>
  );
}
