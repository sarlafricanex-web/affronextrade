"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Producer = {
  id: string;
  name: string;
  location: string;
  sector: string;
  products: string[];
  verified: boolean;
  initials: string;
  color: string;
  logo?: string;
};

const PRODUCERS: Producer[] = [
  { id: "1", name: "Ifri", location: "Ighzer Amokrane, Bejaia", sector: "agrifood", products: ["Eau minerale", "Boissons gazeuses", "Jus de fruits"], verified: true, initials: "IF", color: "#0891b2", logo: "/images/logos/ifri.png" },
  { id: "2", name: "Cevital", location: "Bejaia", sector: "agrifood", products: ["Huile de table", "Sucre", "Margarine"], verified: true, initials: "CV", color: "#059669", logo: "/images/logos/cevital.png" },
  { id: "3", name: "SIM", location: "Blida", sector: "industry", products: ["Electromenager", "Climatiseurs", "Chauffe-eau"], verified: true, initials: "SM", color: "#7c3aed" },
  { id: "4", name: "Condor Electronics", location: "Bordj Bou Arreridj", sector: "industry", products: ["Smartphones", "TV", "Panneaux solaires"], verified: true, initials: "CE", color: "#dc2626", logo: "/images/logos/condor.png" },
  { id: "5", name: "Lalla Khedidja", location: "Tizi Ouzou", sector: "agrifood", products: ["Eau minerale naturelle"], verified: true, initials: "LK", color: "#2563eb" },
  { id: "6", name: "Agrodiv", location: "Guelma", sector: "agrifood", products: ["Concentre de tomate", "Pates", "Couscous", "Harissa"], verified: true, initials: "AG", color: "#ea580c" },
  { id: "7", name: "Toudja Olive Oil", location: "Bejaia", sector: "agrifood", products: ["Huile d'olive extra vierge", "Olives de table"], verified: true, initials: "TO", color: "#65a30d" },
  { id: "8", name: "Biscuiterie Bimo", location: "Blida", sector: "agrifood", products: ["Biscuits", "Gaufrettes", "Chocolat"], verified: true, initials: "BB", color: "#b45309" },
  { id: "9", name: "Henkel Algerie", location: "Alger", sector: "cosmetics", products: ["Produits de soin", "Detergents"], verified: true, initials: "HA", color: "#be185d" },
  { id: "10", name: "Ceramique Saida", location: "Saida", sector: "crafts", products: ["Carrelage", "Ceramique artisanale", "Faience"], verified: true, initials: "CS", color: "#9333ea" },
  { id: "11", name: "Fertial", location: "Annaba", sector: "agriculture", products: ["Engrais phosphates", "Engrais azotes", "Ammoniac"], verified: true, initials: "FT", color: "#0d9488" },
  { id: "12", name: "Hodna Lait", location: "M'sila", sector: "agrifood", products: ["Lait UHT", "Yaourts", "Fromage"], verified: true, initials: "HL", color: "#4f46e5" },
];

const FILTERS = [
  { key: "all", translationKey: "filterAll" },
  { key: "agrifood", translationKey: "filterAgrifood" },
  { key: "industry", translationKey: "filterIndustry" },
  { key: "crafts", translationKey: "filterCrafts" },
  { key: "cosmetics", translationKey: "filterCosmetics" },
  { key: "agriculture", translationKey: "filterAgriculture" },
] as const;

export function ProducerDirectory() {
  const t = useTranslations("producers");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return PRODUCERS.filter((p) => {
      const matchesSector = activeFilter === "all" || p.sector === activeFilter;
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.products.some((prod) => prod.toLowerCase().includes(search.toLowerCase())) ||
        p.location.toLowerCase().includes(search.toLowerCase());
      return matchesSector && matchesSearch;
    });
  }, [activeFilter, search]);

  return (
    <section style={{ background: "var(--field-a)", padding: "var(--section-gap) var(--page-margin)" }}>
      <h2 className="font-extrabold" style={{ fontSize: "var(--step-title)" }}>
        {t("directoryTitle")}
      </h2>
      <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "40ch" }}>
        {t("directorySubtitle")}
      </p>

      {/* Search */}
      <div className="mt-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full max-w-md px-4 py-3 text-sm"
          style={{
            background: "var(--ground)",
            border: "1px solid var(--field-b)",
            outline: "none",
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mt-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: activeFilter === f.key ? "var(--ink)" : "var(--ground)",
              color: activeFilter === f.key ? "var(--ground)" : "var(--muted)",
            }}
          >
            {t(f.translationKey)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px mt-8" style={{ background: "var(--field-b)" }}>
          {filtered.map((producer) => (
            <div
              key={producer.id}
              className="group"
              style={{ background: "var(--ground)", padding: "1.5rem" }}
            >
              <div className="flex items-start gap-3">
                {producer.logo ? (
                  <img
                    src={producer.logo}
                    alt={producer.name}
                    className="w-10 h-10 shrink-0 object-contain"
                  />
                ) : (
                  <div
                    className="w-10 h-10 flex items-center justify-center shrink-0 text-sm font-bold text-white"
                    style={{ background: producer.color }}
                  >
                    {producer.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold truncate">{producer.name}</p>
                    {producer.verified && (
                      <span className="text-xs font-medium shrink-0" style={{ color: "var(--accent)" }}>
                        {t("verified")}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}>
                    {producer.location}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {producer.products.map((product) => (
                  <span
                    key={product}
                    className="text-xs px-2 py-0.5"
                    style={{ background: "var(--field-a)", color: "var(--muted)" }}
                  >
                    {product}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <Link
                  href="/contact"
                  className="text-sm font-semibold transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  {t("contact")}
                </Link>
                <button
                  className="text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  {t("viewProfile")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center" style={{ color: "var(--muted)" }}>
          <p className="text-lg">{t("noResults")}</p>
        </div>
      )}
    </section>
  );
}
