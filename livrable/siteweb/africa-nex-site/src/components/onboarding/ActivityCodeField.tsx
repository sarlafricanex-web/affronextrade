"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CnrcActivity } from "@/lib/cnrc";

const HAIR = "#d8cebb";
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
type Lookup = { activity: CnrcActivity | null; refusal: string | null };
// Les intitules officiels commencent parfois par une minuscule.
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Activite d'export : code CNRC du registre avec lequel l'entreprise travaille. Le code impose le
// secteur ; la description de l'activite est proposee a partir de l'intitule officiel, modifiable.
// Icone loupe : recherche dans la nomenclature par code ou par mots.
export function ActivityCodeField({
  defaultCode,
  defaultDescription,
  error,
  describedBy,
}: {
  defaultCode: string;
  defaultDescription: string;
  error: React.ReactNode;
  describedBy?: { "aria-invalid"?: boolean; "aria-describedby"?: string };
}) {
  const t = useTranslations("onboarding");
  const ts = useTranslations("sectors");
  const locale = useLocale();
  const [code, setCode] = useState(defaultCode);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [description, setDescription] = useState(defaultDescription);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CnrcActivity[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fiche du code saisi (6 chiffres).
  useEffect(() => {
    if (!/^\d{6}$/.test(code)) return;
    let alive = true;
    fetch(`/api/cnrc?code=${code}`).then((r) => r.json()).then((d: Lookup) => {
      if (!alive) return;
      setLookup(d);
      // Description de depart : l'intitule officiel, si le client n'a rien ecrit.
      if (!d.refusal && d.activity) setDescription((cur) => cur || cap(d.activity!.label_fr));
    }).catch(() => {});
    return () => { alive = false; };
  }, [code]);

  // Recherche par mots ou debut de code, apres une courte pause de frappe.
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const id = setTimeout(() => {
      fetch(`/api/cnrc?q=${encodeURIComponent(query.trim())}`).then((r) => r.json()).then((d) => setResults(d.results ?? [])).catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [query, open]);

  const a = /^\d{6}$/.test(code) && lookup?.activity?.code === code ? lookup.activity : null;
  const refusal = /^\d{6}$/.test(code) && lookup && (lookup.activity?.code === code || !lookup.activity) ? lookup.refusal : null;
  const ok = a && !refusal;

  return (
    <div className="flex flex-col gap-3" data-activity-field="">
      <div className="flex gap-2">
        <input
          id="ob-activity"
          name="activityCode"
          required
          inputMode="numeric"
          maxLength={6}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="107301"
          className="w-full px-4 py-3 text-sm"
          style={{ ...box, letterSpacing: "0.12em" }}
          {...describedBy}
        />
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setTimeout(() => searchRef.current?.focus(), 0); }}
          aria-expanded={open}
          aria-controls="activity-search"
          title={t("activitySearch")}
          className="flex shrink-0 items-center gap-2 px-4 text-xs font-bold uppercase"
          style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" /></svg>
          <span className="hidden sm:inline">{t("activitySearch")}</span>
        </button>
      </div>
      {error}

      {open && (
        <div id="activity-search" className="flex flex-col gap-2 p-3" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("activitySearchPlaceholder")}
            aria-label={t("activitySearch")}
            className="w-full px-3 py-2 text-sm"
            style={box}
          />
          <ul className="flex max-h-72 flex-col overflow-y-auto" role="listbox" aria-label={t("activitySearch")}>
            {query.trim().length >= 2 && results.length === 0 && <li className="p-2 text-sm" style={{ color: "var(--muted)" }}>{t("activityNoResult")}</li>}
            {results.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={r.code === code}
                  onClick={() => { setCode(r.code); setOpen(false); }}
                  className="flex w-full flex-col items-start gap-0.5 px-2 py-2 text-start text-sm hover:bg-[#f5efe6]"
                  style={{ borderBottom: `1px solid ${HAIR}` }}
                >
                  <span><strong dir="ltr">{r.code}</strong> · {cap(r.label_fr)}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {ts(r.isic_division!)}{r.status === "regulated" ? ` · ${t("activityRegulatedShort")}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a && (
        <div className="flex flex-col gap-2 p-4" style={{ background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#a7f3d0" : "#fca5a5"}` }} data-activity-card={ok ? "ok" : "refused"}>
          <p className="font-bold">{cap(a.label_fr)}</p>
          {a.label_ar && <p className="text-sm" dir="rtl" lang="ar" style={{ color: "var(--muted)" }}>{a.label_ar}</p>}
          <p className="text-xs font-semibold" style={{ color: a.status === "regulated" ? "#c2410c" : a.status === "blocked" ? "#dc2626" : "#065f46" }}>
            {a.status === "regulated" ? t("activityRegulated", { authority: a.authority || "-" }) : a.status === "blocked" ? t("activityBlocked") : t("activityFree")}
          </p>
          {ok ? (
            <p className="text-sm">
              {t("activitySector")} <strong>{ts(a.isic_division!)}</strong>
            </p>
          ) : (
            <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>{t(refusal!)}</p>
          )}
        </div>
      )}
      {!a && refusal === "errorActivityUnknown" && <p className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t("errorActivityUnknown")}</p>}

      {/* Secteur impose par le code (le serveur le recalcule de toute facon). */}
      <input type="hidden" name="sector" value={ok ? a.isic_division! : ""} />

      <label className="flex flex-col gap-1" htmlFor="ob-activity-desc">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("activityDescription")}</span>
        <textarea id="ob-activity-desc" name="activityDescription" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full resize-y px-4 py-3 text-sm" style={box} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>{t("activityDescriptionHelp")}</span>
      </label>
      <p className="text-[11px]" style={{ color: "var(--muted)" }} lang={locale}>{t("activitySource")}</p>
    </div>
  );
}
