"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const MARKET_KEYS = [
  "nigeria", "cotedivoire", "senegal", "ethiopie", "ghana", "cameroun", "kenya", "centrafrique",
] as const;

type MarketKey = (typeof MARKET_KEYS)[number];

const MARKET_META: Record<MarketKey, { flag: string; imports: string; growth: string; population: string; color: string; productCount: number }> = {
  nigeria:      { flag: "NG", imports: "41",   growth: "+6.2%", population: "230 M", color: "#059669", productCount: 4 },
  cotedivoire:  { flag: "CI", imports: "17",   growth: "+7.1%", population: "30 M",  color: "#f97316", productCount: 4 },
  senegal:      { flag: "SN", imports: "14",   growth: "+8.3%", population: "18 M",  color: "#2563eb", productCount: 4 },
  ethiopie:     { flag: "ET", imports: "20",   growth: "+7.8%", population: "130 M", color: "#7c3aed", productCount: 4 },
  ghana:        { flag: "GH", imports: "18",   growth: "+5.4%", population: "34 M",  color: "#dc2626", productCount: 4 },
  cameroun:     { flag: "CM", imports: "8.3",  growth: "+4.2%", population: "30 M",  color: "#0891b2", productCount: 4 },
  kenya:        { flag: "KE", imports: "22",   growth: "+5.6%", population: "56 M",  color: "#b45309", productCount: 4 },
  centrafrique: { flag: "CF", imports: "0.78", growth: "+3.1%", population: "6 M",   color: "#9333ea", productCount: 4 },
};

function MarketCard({ marketKey, index }: { marketKey: MarketKey; index: number }) {
  const t = useTranslations("markets");
  const [hovered, setHovered] = useState(false);
  const meta = MARKET_META[marketKey];

  const products = Array.from({ length: meta.productCount }, (_, i) => t(`${marketKey}_product${i + 1}`));

  return (
    <div
      className="relative overflow-hidden cursor-crosshair"
      style={{
        minHeight: "340px",
        background: hovered ? meta.color : "var(--ground)",
        transition: "background 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Default state */}
      <div
        className="absolute inset-0 flex flex-col justify-between"
        style={{
          padding: "2rem",
          opacity: hovered ? 0 : 1,
          transform: hovered ? "translateY(-20px)" : "translateY(0)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <p
          className="font-extrabold"
          style={{
            fontSize: "var(--step-heading)",
            letterSpacing: "-0.03em",
          }}
        >
          {t(`${marketKey}_name`)}
        </p>
        <div>
          <p
            className="font-extrabold"
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              color: meta.color,
              lineHeight: 0.9,
            }}
          >
            {meta.imports} {t("billion")}
          </p>
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "var(--step-small)" }}>
            {t("annualImports")}
          </p>
        </div>
      </div>

      {/* Hover state */}
      <div
        className="absolute inset-0 flex flex-col justify-between"
        style={{
          padding: "2rem",
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s",
          color: "white",
        }}
      >
        <div>
          <p className="font-extrabold" style={{ fontSize: "var(--step-heading)", letterSpacing: "-0.03em" }}>
            {t(`${marketKey}_name`)}
          </p>
          <p className="mt-1" style={{ fontSize: "var(--step-small)", opacity: 0.8 }}>
            {t("population")} : {meta.population} / {t("gdpGrowth")} : {meta.growth}
          </p>
        </div>

        <div>
          <p
            className="text-xs font-semibold uppercase"
            style={{ letterSpacing: "0.1em", opacity: 0.7 }}
          >
            {t("topImported")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {products.map((product) => (
              <span
                key={product}
                className="text-sm px-3 py-1"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                {product}
              </span>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.25)", paddingTop: "1rem" }}>
          <p className="text-sm" style={{ opacity: 0.9 }}>{t(`${marketKey}_opportunity`)}</p>
        </div>
      </div>

      {/* Index number */}
      <p
        className="absolute font-extrabold"
        style={{
          bottom: "1rem",
          right: "1.5rem",
          fontSize: "8rem",
          lineHeight: 1,
          opacity: hovered ? 0.1 : 0.04,
          color: hovered ? "white" : meta.color,
          transition: "opacity 0.4s ease, color 0.4s ease",
          pointerEvents: "none",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </p>
    </div>
  );
}

export function MarketGrid() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "var(--field-b)" }}>
      {MARKET_KEYS.map((key, i) => (
        <MarketCard key={key} marketKey={key} index={i} />
      ))}
    </div>
  );
}
