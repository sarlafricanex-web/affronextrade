"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

// Selecteur de langue (demande d'Adlene du 19 novembre 2026) : un bouton rond avec la langue en
// cours ; un clic deroule les trois langues avec une animation. Fermeture au clic exterieur,
// avec Echap ou apres le choix. Clavier : fleches, Debut, Fin. Animation reduite si le systeme le demande.
const LANGUAGES = [
  // Une couleur par langue (demande d'Adlene du 24 novembre 2026) : vert pour le francais, emeraude
  // du logo pour l'anglais, jaune sable pour l'arabe ; texte fonce lisible sur chaque teinte.
  { code: "fr", short: "FR", name: "Français", bg: "#047857", fg: "#ffffff" },
  { code: "en", short: "EN", name: "English", bg: "#10b981", fg: "#052e22" },
  { code: "ar", short: "AR", name: "العربية", bg: "#e9c46a", fg: "#0f172a" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const items = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-lang]") ?? [])];
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("[data-lang-button]")?.focus(); }
    };
    // Focus sur la langue en cours a l'ouverture (apres l'animation d'apparition).
    const focusTimer = setTimeout(() => root.current?.querySelector<HTMLButtonElement>("[data-lang][aria-checked=true]")?.focus(), 30);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(focusTimer); document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function choose(code: string) {
    setOpen(false);
    if (code !== locale) router.replace(pathname, { locale: code });
  }

  return (
    <div ref={root} className="lang-switcher relative" data-open={open || undefined}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Langue : ${current.name}`}
        className="lang-switcher-button flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
        data-lang-button={current.code}
        style={{ background: current.bg, color: current.fg, borderColor: current.bg }}
      >
        {current.short}
      </button>
      <div
        role="menu"
        aria-hidden={!open}
        className="lang-switcher-menu absolute end-0 top-9 flex flex-col p-1.5"
        data-lang-menu=""
        onKeyDown={(e) => {
          const list = items();
          const at = list.indexOf(document.activeElement as HTMLButtonElement);
          const next = e.key === "ArrowDown" ? (at + 1) % list.length : e.key === "ArrowUp" ? (at - 1 + list.length) % list.length : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : -1;
          if (next >= 0) { e.preventDefault(); list[next]?.focus(); }
        }}
      >
        {LANGUAGES.map((l, i) => (
          <button
            key={l.code}
            type="button"
            role="menuitemradio"
            aria-checked={l.code === locale}
            tabIndex={open ? 0 : -1}
            onClick={() => choose(l.code)}
            className="lang-switcher-item flex items-center gap-3 px-3 py-2 text-sm"
            style={{ transitionDelay: open ? `${60 + i * 45}ms` : "0ms" }}
            data-lang={l.code}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: l.bg, color: l.fg }}>
              {l.short}
            </span>
            {/* Meme alignement pour toutes les lignes ; seul le nom prend la langue et le sens. */}
            <span className="flex-1 text-start font-medium"><bdi lang={l.code}>{l.name}</bdi></span>
            {l.code === locale && <span aria-hidden="true" style={{ color: "#065f46" }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
