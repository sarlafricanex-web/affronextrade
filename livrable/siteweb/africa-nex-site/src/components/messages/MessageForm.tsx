"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { sendMessage, type MessageState } from "@/app/[locale]/(app)/message-actions";

const caps = { letterSpacing: "0.08em" } as const;

// Lot 5f : envoi d'un message. Le texte est conserve en cas d'erreur.
// "to" : destinataire vu depuis la console (acheteur ou producteur) ; absent pour l'acheteur et le
// producteur, qui ecrivent toujours a AFRICA NEX.
export function MessageForm({ rfqId, dispatchId, placeholder, initial, closed, to }: { rfqId: string; dispatchId?: string | null; placeholder: string; initial?: string; closed?: boolean; to?: "buyer" | "producer" }) {
  const t = useTranslations("thread");
  const locale = useLocale();
  const [state, action, pending] = useActionState<MessageState, FormData>(sendMessage, {});
  if (closed) return <p className="px-5 py-4 text-sm" style={{ color: "var(--muted)", borderTop: "1px solid #d8cebb" }}>{t("closed")}</p>;
  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-3 px-5 py-4" style={{ borderTop: "1px solid #d8cebb", background: "#fffdf9" }} data-message-form={dispatchId ?? "buyer"}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="rfqId" value={rfqId} />
      {dispatchId && <input type="hidden" name="dispatchId" value={dispatchId} />}
      <textarea
        name="body"
        rows={3}
        maxLength={5000}
        required
        defaultValue={state.value ?? initial ?? ""}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full resize-y px-4 py-3 text-sm"
        style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
      />
      {state.error && <p className="text-xs font-semibold" style={{ color: "#dc2626" }} data-message-error={state.error}>{t(state.error)}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--muted)" }}>{to ? t(`formHint_${to}`) : t("formHint")}</span>
        <button type="submit" disabled={pending} className="px-5 py-2.5 text-xs font-bold uppercase disabled:opacity-60" style={{ ...caps, background: "#065f46", color: "white" }}>
          {pending ? t("sending") : to ? t(`send_${to}`) : t("send")}
        </button>
      </div>
    </form>
  );
}
