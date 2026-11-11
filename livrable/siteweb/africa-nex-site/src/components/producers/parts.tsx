// Elements d'affichage partages par l'annuaire et la fiche producteur (sans etat, rendus serveur ou client).

export const SECTOR_FILTER_KEY: Record<string, string> = {
  agrifood: "filterAgrifood",
  industry: "filterIndustry",
  automotive: "filterAutomotive",
  crafts: "filterCrafts",
  cosmetics: "filterCosmetics",
  agriculture: "filterAgriculture",
};

export function VerifiedBadge({ label }: { label: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="img" aria-label={label} className="shrink-0">
      <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" fill="var(--accent)" />
      <path d="M10 15.17L7.41 12.59L6 14L10 18L18 10L16.59 8.58L10 15.17Z" fill="white" />
    </svg>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width={size} height={size} viewBox="0 0 24 24" fill={star <= Math.round(rating) ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export function ProducerAvatar({ name, logo, initials, color, size = 40 }: { name: string; logo: string | null; initials: string; color: string; size?: number }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={name} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size, background: "white" }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.35 }} aria-hidden="true">
      {initials}
    </div>
  );
}
