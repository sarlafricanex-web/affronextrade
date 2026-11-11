"use client";

import { useTranslations } from "next-intl";
import { SECTIONS, SECTOR_SECTIONS, isSector } from "@/lib/sectors";

type Described = { "aria-invalid"?: boolean; "aria-describedby"?: string };

// Secteur d'activite : divisions CITI Rev.4 regroupees par section (A, B, C, G).
export function SectorSelect({ id, defaultValue, style, described = {} }: { id: string; defaultValue: string; style: React.CSSProperties; described?: Described }) {
  const t = useTranslations("sectors");
  const o = useTranslations("onboarding");
  return (
    <select id={id} name="sector" required defaultValue={isSector(defaultValue) ? defaultValue : ""} className="w-full px-4 py-3 text-sm" style={style} {...described}>
      <option value="" disabled>{o("choose")}</option>
      {SECTIONS.map((section) => (
        <optgroup key={section} label={t(`section_${section}`)}>
          {SECTOR_SECTIONS[section].map((code) => (
            <option key={code} value={code}>{`${code.slice(1)} · ${t(code)}`}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
