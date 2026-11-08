"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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

type Review = {
  id: number;
  author_name: string;
  author_company: string;
  author_country: string;
  rating: number;
  comment: string;
  created_at: string;
};

type RatingData = {
  producer_id: string;
  avg_rating: string;
  review_count: number;
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
  { id: "13", name: "MOTRIO Algerie", location: "Alger", sector: "automotive", products: ["Filtres", "Plaquettes de frein", "Batteries", "Radiateurs", "Kits distribution"], verified: true, initials: "MO", color: "#dc2626", logo: "/images/logos/motrio.png" },
  { id: "14", name: "IRIS Tyres", location: "Setif", sector: "automotive", products: ["Pneumatiques tourisme", "Pneumatiques utilitaires", "Pneumatiques semi-lourds"], verified: true, initials: "IT", color: "#ea580c" },
  { id: "15", name: "FB Radiateur", location: "Ain M'lila, Oum El Bouaghi", sector: "automotive", products: ["Radiateurs automobile", "Systemes de refroidissement"], verified: true, initials: "FB", color: "#1d4ed8" },
  { id: "16", name: "Cirta Automotive", location: "Constantine", sector: "automotive", products: ["Pieces detachees", "Sous-ensembles", "Composants mecaniques"], verified: true, initials: "CA", color: "#0f766e" },
];

const FILTERS = [
  { key: "all", translationKey: "filterAll" },
  { key: "agrifood", translationKey: "filterAgrifood" },
  { key: "industry", translationKey: "filterIndustry" },
  { key: "automotive", translationKey: "filterAutomotive" },
  { key: "crafts", translationKey: "filterCrafts" },
  { key: "cosmetics", translationKey: "filterCosmetics" },
  { key: "agriculture", translationKey: "filterAgriculture" },
] as const;

function VerifiedBadge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Verified">
      <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" fill="var(--accent)" />
      <path d="M10 15.17L7.41 12.59L6 14L10 18L18 10L16.59 8.58L10 15.17Z" fill="white" />
    </svg>
  );
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width={size} height={size} viewBox="0 0 24 24" fill={star <= Math.round(rating) ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-1 cursor-pointer">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill={(hover || value) >= star ? "#f59e0b" : "none"}
          stroke="#f59e0b"
          strokeWidth="2"
          style={{ cursor: "pointer", transition: "transform 0.15s" }}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

function ReviewModal({
  producer,
  onClose,
  ratings,
}: {
  producer: Producer;
  onClose: () => void;
  ratings: Map<string, RatingData>;
}) {
  const t = useTranslations("producers");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [authorCompany, setAuthorCompany] = useState("");
  const [authorCountry, setAuthorCountry] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const ratingData = ratings.get(producer.id);

  useEffect(() => {
    fetch(`/api/reviews?producerId=${producer.id}`)
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [producer.id]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !authorName) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producerId: producer.id,
          authorName,
          authorCompany,
          authorCountry,
          rating: String(rating),
          comment,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        const refreshed = await fetch(`/api/reviews?producerId=${producer.id}`).then((r) => r.json());
        setReviews(refreshed.reviews ?? []);
      }
    } catch {}
    setSubmitting(false);
  }, [producer.id, authorName, authorCompany, authorCountry, rating, comment]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--ground)", margin: "1rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between" style={{ background: "var(--ground)", padding: "1.5rem 1.5rem 1rem", borderBottom: "1px solid var(--field-b)" }}>
          <div className="flex items-center gap-3">
            {producer.logo ? (
              <img src={producer.logo} alt={producer.name} className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 flex items-center justify-center text-sm font-bold text-white" style={{ background: producer.color }}>
                {producer.initials}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">{producer.name}</p>
                {producer.verified && <VerifiedBadge />}
              </div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{producer.location}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2" style={{ color: "var(--muted)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Rating summary */}
        <div className="flex items-center gap-4" style={{ padding: "1.5rem" }}>
          <div className="text-center">
            <p className="font-extrabold" style={{ fontSize: "2.5rem", lineHeight: 1 }}>
              {ratingData ? Number(ratingData.avg_rating).toFixed(1) : "—"}
            </p>
            <Stars rating={ratingData ? Number(ratingData.avg_rating) : 0} size={16} />
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {ratingData ? `${ratingData.review_count} ${t("reviewCount")}` : t("noReviews")}
          </p>
        </div>

        {/* Reviews list */}
        <div style={{ padding: "0 1.5rem" }}>
          {loading ? (
            <p className="text-sm py-4" style={{ color: "var(--muted)" }}>...</p>
          ) : reviews.length > 0 ? (
            <div className="flex flex-col gap-4">
              {reviews.map((review) => (
                <div key={review.id} style={{ borderBottom: "1px solid var(--field-b)", paddingBottom: "1rem" }}>
                  <div className="flex items-center gap-2">
                    <Stars rating={review.rating} size={12} />
                    <span className="text-sm font-semibold">{review.author_name}</span>
                    {review.author_company && (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{review.author_company}</span>
                    )}
                  </div>
                  {review.comment && <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{review.comment}</p>}
                  <p className="mt-1 text-xs" style={{ color: "var(--field-b)" }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm py-2" style={{ color: "var(--muted)" }}>{t("noReviews")}</p>
          )}
        </div>

        {/* Submit form */}
        <div style={{ padding: "1.5rem", borderTop: "1px solid var(--field-b)", marginTop: "1rem" }}>
          {submitted ? (
            <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{t("reviewThanks")}</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="font-semibold text-sm">{t("leaveReview")}</p>
              <StarInput value={rating} onChange={setRating} />
              <input
                type="text"
                placeholder={t("reviewName")}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                required
                className="px-3 py-2 text-sm"
                style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t("reviewCompany")}
                  value={authorCompany}
                  onChange={(e) => setAuthorCompany(e.target.value)}
                  className="px-3 py-2 text-sm"
                  style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
                />
                <input
                  type="text"
                  placeholder={t("reviewCountry")}
                  value={authorCountry}
                  onChange={(e) => setAuthorCountry(e.target.value)}
                  className="px-3 py-2 text-sm"
                  style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
                />
              </div>
              <textarea
                placeholder={t("reviewComment")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="px-3 py-2 text-sm resize-none"
                style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
              />
              <button
                type="submit"
                disabled={submitting || !rating || !authorName}
                className="px-4 py-2 text-sm font-semibold transition-opacity"
                style={{
                  background: "var(--ink)",
                  color: "var(--ground)",
                  opacity: submitting || !rating || !authorName ? 0.5 : 1,
                }}
              >
                {submitting ? "..." : t("submitReview")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProducerDirectory() {
  const t = useTranslations("producers");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [ratings, setRatings] = useState<Map<string, RatingData>>(new Map());
  const [selectedProducer, setSelectedProducer] = useState<Producer | null>(null);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<string, RatingData>();
        (data.ratings ?? []).forEach((r: RatingData) => map.set(r.producer_id, r));
        setRatings(map);
      })
      .catch(() => {});
  }, [selectedProducer]);

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
          {filtered.map((producer) => {
            const rd = ratings.get(producer.id);
            return (
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
                      {producer.verified && <VerifiedBadge />}
                    </div>
                    <p style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}>
                      {producer.location}
                    </p>
                  </div>
                </div>

                {/* Rating */}
                <div className="mt-2 flex items-center gap-2">
                  <Stars rating={rd ? Number(rd.avg_rating) : 0} size={12} />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {rd ? `${Number(rd.avg_rating).toFixed(1)} (${rd.review_count})` : t("noReviews")}
                  </span>
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
                    onClick={() => setSelectedProducer(producer)}
                  >
                    {t("viewProfile")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center" style={{ color: "var(--muted)" }}>
          <p className="text-lg">{t("noResults")}</p>
        </div>
      )}

      {selectedProducer && (
        <ReviewModal
          producer={selectedProducer}
          onClose={() => setSelectedProducer(null)}
          ratings={ratings}
        />
      )}
    </section>
  );
}
