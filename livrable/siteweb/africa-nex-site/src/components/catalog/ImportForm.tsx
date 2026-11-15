"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { importPriceList, type ImportState } from "@/app/[locale]/(app)/catalog/import/actions";
import { Alert } from "@/components/auth/fields";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Import de la liste de prix : verification (apercu) puis application. Le formulaire n'est pas
// soumis comme action de formulaire : React le viderait, et le fournisseur devrait redeposer son fichier.
export function ImportForm() {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ImportState, FormData>(importPriceList, {});
  const [, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const send = (intent: "preview" | "apply") => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("intent", intent);
    startTransition(() => action(fd));
  };
  const s = state.summary;
  const label = (field: string) => (t.has(`importField_${field}`) ? t(`importField_${field}`) : field);
  const o = useTranslations("onboarding");
  const message = (key: string) => (t.has(key) ? t(key) : o.has(key) ? o(key) : key);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); send("preview"); }} className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <input type="hidden" name="locale" value={locale} />
        <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center" style={{ border: `2px dashed ${HAIR}`, background: "#fff8f3" }}>
          <span className="font-bold">{fileName ?? t("importPick")}</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{t("importPickHelp")}</span>
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? null)}
          />
        </label>
        {state.formError && <Alert tone={state.formError === "importPartial" ? "success" : "error"}>{message(state.formError)}</Alert>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending || !fileName} className="px-6 py-3 text-xs font-bold uppercase disabled:opacity-50" style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>
            {pending ? t("importChecking") : t("importCheck")}
          </button>
          {s && (s.updates > 0 || s.creates > 0) && (
            <button type="button" onClick={() => send("apply")} disabled={pending} className="px-6 py-3 text-xs font-bold uppercase disabled:opacity-50" style={{ ...caps, background: "#10b981", color: "white" }}>
              {t("importApply", { count: s.updates + s.creates })}
            </button>
          )}
        </div>
      </form>

      {s && (
        <section className="flex flex-col gap-4" aria-live="polite" data-import-summary="">
          <div className="grid gap-3 sm:grid-cols-4">
            {([["importUpdates", s.updates, "#059669"], ["importCreates", s.creates, "#059669"], ["importUnchanged", s.unchanged, "var(--muted)"], ["importIssues", s.issues.length, s.issues.length ? "#dc2626" : "var(--muted)"]] as const).map(([k, n, color]) => (
              <div key={k} className="p-4" style={{ background: "white", border: `1px solid ${HAIR}` }} data-count={k}>
                <p className="text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t(k)}</p>
                <p className="font-extrabold" style={{ fontSize: "1.8rem", color }}>{n}</p>
              </div>
            ))}
          </div>

          {s.issues.length > 0 && (
            <div style={{ background: "white", border: "1px solid #fca5a5" }}>
              <h2 className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#fef2f2", color: "#991b1b" }}>{t("importIssuesTitle")}</h2>
              <ul className="text-sm">
                {s.issues.map((i, n) => (
                  <li key={n} className="px-4 py-2" style={{ borderTop: `1px solid ${HAIR}` }} data-issue-row={i.row}>
                    <strong>{i.row ? t("importRow", { row: i.row, sheet: t(`importSheet_${i.sheet}`) }) : t(`importSheet_${i.sheet}`)}</strong>
                    <span dir="ltr"> ({i.ref})</span> : {i.fields.map((f) => `${label(f.field)} : ${message(f.error)}`).join(" ; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.warnings.length > 0 && (
            <div style={{ background: "white", border: "1px solid #f97316" }} data-import-warnings={s.warnings.length}>
              <h2 className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#fff7ed", color: "#9a3412" }}>{t("importWarningsTitle")}</h2>
              <ul className="text-sm">
                {s.warnings.map((w, n) => (
                  <li key={n} className="px-4 py-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                    <strong>{t("importRow", { row: w.row, sheet: t("importSheet_packaging") })}</strong>
                    <span dir="ltr"> ({w.ref})</span> : {w.warnings.map((x) => t(x.code, { level: x.level ?? 0, value: x.value ?? 0 })).join(" ; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.changes.length > 0 && (
            <div style={{ background: "white", border: `1px solid ${HAIR}` }}>
              <h2 className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6" }}>{t("importChangesTitle")}</h2>
              <ul className="text-sm">
                {s.changes.map((c, n) => (
                  <li key={n} className="flex flex-wrap gap-2 px-4 py-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                    <span className="px-2 text-[10px] font-bold uppercase" style={{ ...caps, background: c.kind === "create" ? "#ecfdf5" : "#f5efe6", border: `1px solid ${HAIR}` }}>{t(c.kind === "create" ? "importKindCreate" : "importKindUpdate")}</span>
                    <strong dir="ltr">{c.ref}</strong>
                    <span style={{ color: "var(--muted)" }}>{c.fields.map((f) => label(f)).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
