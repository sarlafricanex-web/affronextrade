"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CnrcActivity } from "@/lib/cnrc";

const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
type Lookup = { activity: CnrcActivity | null; refusal: string | null };
// Les intitules officiels commencent parfois par une minuscule.
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Activite d'export : le client saisit le code d'activite de son registre, la plateforme affiche
// l'activite CNRC correspondante et il la valide. Le code impose le secteur ; la description
// de l'activite, proposee a partir de l'intitule officiel, reste modifiable.
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
  // Un code deja enregistre est deja valide ; tout nouveau code doit l'etre.
  const [confirmed, setConfirmed] = useState(Boolean(defaultCode));

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) return;
    let alive = true;
    fetch(`/api/cnrc?code=${code}`).then((r) => r.json()).then((d: Lookup) => { if (alive) setLookup(d); }).catch(() => {});
    return () => { alive = false; };
  }, [code]);

  const complete = /^\d{6}$/.test(code);
  const current = complete && lookup && (lookup.activity?.code === code || !lookup.activity) ? lookup : null;
  const a = current?.activity ?? null;
  const refusal = current?.refusal ?? null;
  const ok = Boolean(a && !refusal);

  return (
    <div className="flex flex-col gap-3" data-activity-field="">
      <input
        id="ob-activity"
        name="activityCode"
        required
        inputMode="numeric"
        maxLength={6}
        dir="ltr"
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setConfirmed(false); }}
        placeholder="107601"
        className="w-full px-4 py-3 text-sm sm:max-w-xs"
        style={{ ...box, letterSpacing: "0.12em" }}
        {...describedBy}
      />
      {error}

      {a && (
        <div className="flex flex-col gap-2 p-4" style={{ background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#a7f3d0" : "#fca5a5"}` }} data-activity-card={ok ? (confirmed ? "confirmed" : "ok") : "refused"}>
          <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("activityFound", { code })}</p>
          <p className="font-bold">{cap(a.label_fr)}</p>
          {a.label_ar && <p className="text-sm" dir="rtl" lang="ar" style={{ color: "var(--muted)" }}>{a.label_ar}</p>}
          <p className="text-xs font-semibold" style={{ color: a.status === "regulated" ? "#c2410c" : a.status === "blocked" ? "#dc2626" : "#065f46" }}>
            {a.status === "regulated" ? t("activityRegulated", { authority: a.authority || "-" }) : a.status === "blocked" ? t("activityBlocked") : t("activityFree")}
          </p>
          {ok ? (
            <>
              <p className="text-sm">{t("activitySector")} <strong>{ts(a.isic_division!)}</strong></p>
              {confirmed ? (
                <p className="text-sm font-bold" style={{ color: "#065f46" }}>✓ {t("activityConfirmed")}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => { setConfirmed(true); setDescription((cur) => cur || cap(a.label_fr)); }}
                  className="w-fit px-5 py-2.5 text-xs font-bold uppercase"
                  style={{ background: "#047857", color: "white", letterSpacing: "0.08em" }}
                >
                  {t("activityConfirm")}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>{t(refusal!)}</p>
          )}
        </div>
      )}
      {complete && current && !a && <p className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t("errorActivityUnknown")}</p>}

      {/* Validation de l'activite et secteur impose par le code (le serveur recalcule et controle). */}
      <input type="hidden" name="activityConfirmed" value={ok && confirmed ? "1" : ""} />
      <input type="hidden" name="sector" value={ok ? a!.isic_division! : ""} />

      {ok && confirmed && (
        <label className="flex flex-col gap-1" htmlFor="ob-activity-desc">
          <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("activityDescription")}</span>
          <textarea id="ob-activity-desc" name="activityDescription" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full resize-y px-4 py-3 text-sm" style={box} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>{t("activityDescriptionHelp")}</span>
        </label>
      )}
      <p className="text-[11px]" style={{ color: "var(--muted)" }} lang={locale}>{t("activitySource")}</p>
    </div>
  );
}
