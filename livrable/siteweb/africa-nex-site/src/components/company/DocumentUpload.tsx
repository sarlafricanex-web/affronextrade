"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { uploadDocument, type DocumentState } from "@/app/[locale]/(app)/company/document-actions";
import { Field, TextInput } from "@/components/auth/fields";
import { DOCUMENT_KINDS, DOCUMENT_MAX_BYTES } from "@/lib/documents";
import { prepareUpload } from "@/lib/client/prepare-upload";

const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export function DocumentUpload() {
  const t = useTranslations("documents");
  const locale = useLocale();
  const [state, action, pending] = useActionState<DocumentState, FormData>(uploadDocument, {});
  const [file, setFile] = useState<{ label: string; attempt?: number } | null>(null);
  const [localError, setLocalError] = useState<{ key: string; attempt?: number } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const v = state.values ?? { kind: "", title: "", expiresOn: "", isPublic: "" };
  const shownFile = file && file.attempt === state.attempt ? file.label : null;
  const error = localError && localError.attempt === state.attempt ? localError.key : state.error;
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} Mo`;

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "#dc2626" }}>{t(error)}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("kind")} htmlFor="doc-kind">
          <select id="doc-kind" name="kind" required defaultValue={v.kind} className="w-full px-4 py-3 text-sm" style={box}>
            <option value="" disabled>{t("choose")}</option>
            {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{t(`kind_${k}`)}</option>)}
          </select>
        </Field>
        <Field label={t("title")} hint={t("optional")} htmlFor="doc-title">
          <TextInput id="doc-title" name="title" maxLength={200} defaultValue={v.title} placeholder={t("titlePlaceholder")} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("file")}</span>
        <label className="w-fit cursor-pointer px-5 py-3 text-sm font-bold uppercase" style={{ border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
          {t("chooseFile")}
          <input
            type="file"
            name="file"
            required
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={async (e) => {
              const input = e.currentTarget;
              setLocalError(null);
              setPreparing(true);
              const original = input.files?.[0];
              const result = await prepareUpload(input, { maxBytes: DOCUMENT_MAX_BYTES, allowPdf: true });
              setPreparing(false);
              if (!result.ok) {
                setFile(null);
                setLocalError({ key: result.reason === "tooBig" ? "docErrorSize" : "docErrorType", attempt: state.attempt });
                return;
              }
              if (result.file && original) {
                const reduced = result.file !== original;
                setFile({ label: reduced ? t("reduced", { name: original.name, from: mb(original.size), to: mb(result.file.size) }) : `${original.name} (${mb(original.size)})`, attempt: state.attempt });
              } else setFile(null);
            }}
          />
        </label>
        {preparing && <span className="text-sm" style={{ color: "var(--muted)" }}>{t("preparing")}</span>}
        {shownFile && !preparing && <span className="text-sm font-semibold">{shownFile}</span>}
        <span className="text-xs" style={{ color: "var(--muted)" }}>{t("fileHelp")}</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("expiresOn")} hint={t("optional")} htmlFor="doc-expires">
          <TextInput id="doc-expires" name="expiresOn" type="date" dir="ltr" defaultValue={v.expiresOn} />
        </Field>
        <label className="flex items-start gap-3 self-end p-3 text-sm" style={{ border: "1px solid var(--field-b)" }}>
          <input type="checkbox" name="isPublic" defaultChecked={v.isPublic === "on"} className="mt-1" />
          <span>
            <span className="block font-semibold">{t("isPublic")}</span>
            <span className="block text-xs" style={{ color: "var(--muted)" }}>{t("isPublicHelp")}</span>
          </span>
        </label>
      </div>

      <button type="submit" disabled={pending || preparing} className="w-fit px-8 py-3 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
