"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitClaim, type ClaimField, type ClaimState } from "@/app/[locale]/(app)/claim/actions";
import { Alert } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { prepareUpload } from "@/lib/client/prepare-upload";

// Formulaire de revendication d'apres la maquette Stitch 11 (champs a prefixe, zone de depot).
export type ClaimDefaults = { nif: string; workEmail: string; phone: string; jobTitle: string; message: string };

const HAIR = "#d8cebb";
const FIELD = "#e3d9c8";
const label = "mb-2 block text-[11px] font-bold uppercase";
const labelStyle = { letterSpacing: "0.08em", color: "var(--muted)" } as const;
const JOB_KEYS = ["jobManager", "jobCeo", "jobExport", "jobSales", "jobAdmin"] as const;

function Prefixed({ prefix, children }: { prefix: string; children: ReactNode }) {
  return (
    <div className="flex items-stretch" dir="ltr" style={{ border: `1px solid ${HAIR}`, background: FIELD }}>
      <span className="flex items-center px-3 text-xs font-bold" style={{ background: "white", borderInlineEnd: `1px solid ${HAIR}` }}>{prefix}</span>
      {children}
    </div>
  );
}

export function ClaimForm({ slug, companyName, defaults: initial }: { slug: string; companyName: string; defaults: ClaimDefaults }) {
  const t = useTranslations("claim");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ClaimState, FormData>(submitClaim, { errors: {} });
  const defaults = { ...initial, ...(state.values ?? {}) } as ClaimDefaults;
  const [file, setFile] = useState<{ text: string; error: boolean; attempt?: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shownFile = file && file.attempt === state.attempt ? file : null;
  const err = (field: ClaimField) =>
    state.errors[field] ? <span className="mt-1 block text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[field]!)}</span> : null;
  const inputClass = "w-full min-w-0 bg-transparent px-3 py-3 text-sm";
  const inputStyle = { border: 0, outline: "none" } as const;

  async function prepare(input: HTMLInputElement) {
    // Photo de telephone reduite avant l'envoi (limite de 4 Mo) ; PDF laisse tel quel.
    const result = await prepareUpload(input, { maxBytes: 4 * 1024 * 1024, allowPdf: true });
    if (!result.ok) {
      setFile({ text: t(result.reason === "tooBig" ? "errorEvidenceSize" : "errorEvidenceType"), error: true, attempt: state.attempt });
      return;
    }
    setFile(result.file ? { text: result.file.name, error: false, attempt: state.attempt } : null);
  }

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <div>
        <label htmlFor="cl-nif" className={label} style={labelStyle}>{t("nif")} *</label>
        <Prefixed prefix="NIF">
          <input id="cl-nif" name="nif" required inputMode="numeric" maxLength={24} placeholder="00000000000000000000" defaultValue={defaults.nif} className={inputClass} style={inputStyle} />
        </Prefixed>
        <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{t("nifHelp")}</span>
        {err("nif")}
      </div>

      <div>
        <label htmlFor="cl-email" className={label} style={labelStyle}>{t("workEmail")} *</label>
        <Prefixed prefix="@">
          <input id="cl-email" name="workEmail" type="email" required autoComplete="email" placeholder={t("workEmailPlaceholder")} defaultValue={defaults.workEmail} className={inputClass} style={inputStyle} />
        </Prefixed>
        <span className="mt-1 block text-xs" style={{ color: "#059669" }}>{t("workEmailHint")}</span>
        {err("workEmail")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-phone" className={label} style={labelStyle}>{t("phone")} *</label>
          <PhoneField id="cl-phone" name="phone" required defaultValue={defaults.phone || undefined} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="cl-job" className={label} style={labelStyle}>{t("jobTitle")} *</label>
          <input id="cl-job" name="jobTitle" required maxLength={100} list="cl-job-list" placeholder={t("jobTitlePlaceholder")} defaultValue={defaults.jobTitle} className="w-full px-3 py-3 text-sm" style={{ background: FIELD, border: `1px solid ${HAIR}`, outline: "none" }} />
          <datalist id="cl-job-list">
            {JOB_KEYS.map((k) => <option key={k} value={t(k)} />)}
          </datalist>
          {err("jobTitle")}
        </div>
      </div>

      <div>
        <span className={label} style={labelStyle}>{t("evidence")} *</span>
        <label
          className="flex cursor-pointer flex-col items-center gap-2 px-6 py-8 text-center"
          style={{ background: dragging ? "#faecdc" : "#fff8f3", border: `2px dashed ${dragging ? "var(--ink)" : HAIR}` }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (!dropped || !inputRef.current) return;
            const dt = new DataTransfer();
            dt.items.add(dropped);
            inputRef.current.files = dt.files;
            void prepare(inputRef.current);
          }}
        >
          <span className="flex h-11 w-11 items-center justify-center" style={{ background: "white", border: "1px solid var(--ink)" }} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M14 2H6v20h12V6l-4-4zM12 18v-6M9 15l3-3 3 3" /></svg>
          </span>
          <span className="font-bold">{t("dropTitle")}</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{t("dropText")}</span>
          <span className="mt-1 px-4 py-2 text-xs font-bold uppercase" style={{ background: "white", border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>{t("evidenceButton")}</span>
          <input ref={inputRef} type="file" name="evidence" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => void prepare(e.currentTarget)} />
        </label>
        <div className="mt-1 flex justify-between text-[11px] uppercase" style={{ ...labelStyle, fontWeight: 600 }}>
          <span>{t("formats")}</span>
          <span>{t("maxSize")}</span>
        </div>
        {shownFile && <p className="mt-2 text-sm font-semibold" dir="ltr" style={{ color: shownFile.error ? "#dc2626" : "var(--ink)" }}>{shownFile.text}</p>}
        {err("evidence")}
      </div>

      <div>
        <label htmlFor="cl-message" className={label} style={labelStyle}>{t("message")} ({t("optional").toLowerCase()})</label>
        <textarea id="cl-message" name="message" rows={3} maxLength={2000} placeholder={t("messagePlaceholder")} defaultValue={defaults.message} className="w-full resize-y px-3 py-3 text-sm" style={{ background: FIELD, border: `1px solid ${HAIR}`, outline: "none" }} />
        {err("message")}
      </div>

      <label className="flex items-start gap-3 p-4 text-sm" style={{ background: "#fff2e2", borderInlineStart: "4px solid var(--ink)" }}>
        <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0" style={{ accentColor: "var(--ink)" }} />
        <span>{t("consentFull", { name: companyName })}</span>
      </label>
      {err("consent")}

      <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "#10b981", color: "white", letterSpacing: "0.08em" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
