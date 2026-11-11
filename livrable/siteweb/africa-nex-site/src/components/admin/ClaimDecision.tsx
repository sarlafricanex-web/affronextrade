"use client";

import { useLocale, useTranslations } from "next-intl";
import { decideClaim } from "@/app/[locale]/(app)/admin/claims/actions";

// Approuver ou refuser, avec confirmation : la decision transfere (ou non) la fiche.
export function ClaimDecision({ id, company, claimant }: { id: string; company: string; claimant: string }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  return (
    <form
      action={decideClaim}
      className="flex flex-wrap gap-3"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const key = submitter?.value === "approve" ? "claimConfirmApprove" : "claimConfirmReject";
        if (!window.confirm(t(key, { company, claimant }))) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" name="decision" value="approve" className="px-4 py-2 text-xs font-bold uppercase" style={{ background: "var(--accent)", color: "white", letterSpacing: "0.08em" }}>
        {t("claimApprove")}
      </button>
      <button type="submit" name="decision" value="reject" className="px-4 py-2 text-xs font-bold uppercase" style={{ border: "1px solid #dc2626", color: "#dc2626", letterSpacing: "0.08em" }}>
        {t("claimReject")}
      </button>
    </form>
  );
}
