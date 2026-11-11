"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitClaim, type ClaimField, type ClaimState } from "@/app/[locale]/(app)/claim/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { prepareUpload } from "@/lib/client/prepare-upload";

export type ClaimDefaults = { nif: string; workEmail: string; phone: string; jobTitle: string; message: string };

export function ClaimForm({ slug, defaults: initial }: { slug: string; defaults: ClaimDefaults }) {
  const t = useTranslations("claim");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ClaimState, FormData>(submitClaim, { errors: {} });
  const defaults = { ...initial, ...(state.values ?? {}) } as ClaimDefaults;
  const [fileName, setFileName] = useState<{ name: string; attempt?: number } | null>(null);
  const shownFile = fileName && fileName.attempt === state.attempt ? fileName.name : null;
  const err = (field: ClaimField) =>
    state.errors[field] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[field]!)}</span> : null;

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("nif")} hint={t("nifHint")} htmlFor="cl-nif">
          <TextInput id="cl-nif" name="nif" required inputMode="numeric" dir="ltr" placeholder="000000000000000" defaultValue={defaults.nif} />
          {err("nif")}
        </Field>
        <Field label={t("jobTitle")} htmlFor="cl-job">
          <TextInput id="cl-job" name="jobTitle" required maxLength={100} placeholder={t("jobTitlePlaceholder")} defaultValue={defaults.jobTitle} />
          {err("jobTitle")}
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("workEmail")} hint={t("workEmailHint")} htmlFor="cl-email">
          <TextInput id="cl-email" name="workEmail" type="email" required dir="ltr" autoComplete="email" defaultValue={defaults.workEmail} />
          {err("workEmail")}
        </Field>
        <Field label={t("phone")} htmlFor="cl-phone">
          <PhoneField id="cl-phone" name="phone" required defaultValue={defaults.phone || undefined} />
          {err("phone")}
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("evidence")}</span>
        <label className="w-fit cursor-pointer px-5 py-3 text-sm font-bold uppercase" style={{ border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
          {t("evidenceButton")}
          <input
            type="file"
            name="evidence"
            accept="application/pdf,image/png,image/jpeg"
            className="sr-only"
            onChange={async (e) => {
              // Photo de telephone reduite avant l'envoi (limite de 4 Mo) ; PDF laisse tel quel.
              const input = e.currentTarget;
              const result = await prepareUpload(input, { maxBytes: 4 * 1024 * 1024, allowPdf: true });
              if (!result.ok) {
                setFileName({ name: t(result.reason === "tooBig" ? "errorEvidenceSize" : "errorEvidenceType"), attempt: state.attempt });
                return;
              }
              setFileName(result.file ? { name: result.file.name, attempt: state.attempt } : null);
            }}
          />
        </label>
        {shownFile && <span className="text-sm font-semibold" dir="ltr">{shownFile}</span>}
        <span className="text-xs" style={{ color: "var(--muted)" }}>{t("evidenceHelp")}</span>
        {err("evidence")}
      </div>

      <Field label={t("message")} hint={t("optional")} htmlFor="cl-message">
        <textarea id="cl-message" name="message" rows={3} maxLength={2000} defaultValue={defaults.message} className="w-full resize-y px-4 py-3 text-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }} />
        {err("message")}
      </Field>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-1" />
        <span>{t("consent")}</span>
      </label>
      {err("consent")}

      <div className="pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
        <button type="submit" disabled={pending} className="mt-4 w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:px-10" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {pending ? t("sending") : t("submit")}
        </button>
      </div>
    </form>
  );
}
