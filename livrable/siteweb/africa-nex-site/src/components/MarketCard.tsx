"use client";

import { useState } from "react";

type MarketData = {
  country: string;
  flag: string;
  imports: string;
  topProducts: string[];
  growth: string;
  population: string;
  opportunity: string;
  color: string;
};

const MARKETS: MarketData[] = [
  {
    country: "Nigeria",
    flag: "NG",
    imports: "41 Md USD",
    topProducts: ["Cereales", "Ciment", "Vehicules", "Produits chimiques"],
    growth: "+6.2%",
    population: "230 M",
    opportunity: "1er marche du continent, demande massive en materiaux et agroalimentaire",
    color: "#059669",
  },
  {
    country: "Cote d'Ivoire",
    flag: "CI",
    imports: "17 Md USD",
    topProducts: ["Riz", "Huiles", "Ciment", "Engrais"],
    growth: "+7.1%",
    population: "30 M",
    opportunity: "Hub economique d'Afrique de l'Ouest, porte d'entree regionale",
    color: "#f97316",
  },
  {
    country: "Senegal",
    flag: "SN",
    imports: "14 Md USD",
    topProducts: ["Produits petroliers", "Riz", "Machines", "Fer et acier"],
    growth: "+8.3%",
    population: "18 M",
    opportunity: "Boom petrolier et gazier, infrastructure en expansion rapide",
    color: "#2563eb",
  },
  {
    country: "Ethiopie",
    flag: "ET",
    imports: "20 Md USD",
    topProducts: ["Machines", "Cereales", "Engrais", "Produits pharmaceutiques"],
    growth: "+7.8%",
    population: "130 M",
    opportunity: "2e population du continent, industrialisation acceleree",
    color: "#7c3aed",
  },
  {
    country: "Ghana",
    flag: "GH",
    imports: "18 Md USD",
    topProducts: ["Vehicules", "Ciment", "Produits alimentaires", "Fer et acier"],
    growth: "+5.4%",
    population: "34 M",
    opportunity: "Economie stable, classe moyenne en croissance rapide",
    color: "#dc2626",
  },
  {
    country: "Cameroun",
    flag: "CM",
    imports: "8.3 Md USD",
    topProducts: ["Cereales", "Poissons", "Medicaments", "Ciment"],
    growth: "+4.2%",
    population: "30 M",
    opportunity: "Carrefour entre Afrique de l'Ouest et Afrique Centrale",
    color: "#0891b2",
  },
  {
    country: "Kenya",
    flag: "KE",
    imports: "22 Md USD",
    topProducts: ["Machines", "Produits petroliers", "Fer et acier", "Huiles vegetales"],
    growth: "+5.6%",
    population: "56 M",
    opportunity: "Hub technologique et logistique de l'Afrique de l'Est",
    color: "#b45309",
  },
  {
    country: "Centrafrique",
    flag: "CF",
    imports: "0.78 Md USD",
    topProducts: ["Produits alimentaires", "Medicaments", "Ciment", "Textiles"],
    growth: "+3.1%",
    population: "6 M",
    opportunity: "Marche sous-approvisionne, demande non satisfaite en biens essentiels",
    color: "#9333ea",
  },
];

export function MarketCard({ market, index }: { market: MarketData; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative overflow-hidden cursor-crosshair"
      style={{
        minHeight: "340px",
        background: hovered ? market.color : "var(--ground)",
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
          {market.country}
        </p>
        <div>
          <p
            className="font-extrabold"
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              color: market.color,
              lineHeight: 0.9,
            }}
          >
            {market.imports}
          </p>
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "var(--step-small)" }}>
            d'importations annuelles
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
            {market.country}
          </p>
          <p className="mt-1" style={{ fontSize: "var(--step-small)", opacity: 0.8 }}>
            Population : {market.population} / Croissance PIB : {market.growth}
          </p>
        </div>

        <div>
          <p
            className="text-xs font-semibold uppercase"
            style={{ letterSpacing: "0.1em", opacity: 0.7 }}
          >
            Produits les plus importes
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {market.topProducts.map((product) => (
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
          <p className="text-sm" style={{ opacity: 0.9 }}>{market.opportunity}</p>
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
          color: hovered ? "white" : market.color,
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
      {MARKETS.map((market, i) => (
        <MarketCard key={market.flag} market={market} index={i} />
      ))}
    </div>
  );
}
