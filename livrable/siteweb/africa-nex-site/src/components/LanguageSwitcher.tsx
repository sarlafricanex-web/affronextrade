"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

// Selecteur de langue (demandes d'Adlene des 19 et 24 novembre 2026) : une bulle blanche, texte noir,
// sans rebord ; un clic fait descendre de la bulle un cylindre blanc de meme largeur qui porte les
// deux autres langues.
// Fermeture au clic exterieur, avec Echap ou apres le choix. Clavier : fleches, Debut, Fin.
const LANGUAGES = [
  { code: "fr", short: "FR", name: "Français" },
  { code: "en", short: "EN", name: "English" },
  { code: "ar", short: "AR", name: "العربية" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const items = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-lang]") ?? [])];
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];
  const others = LANGUAGES.filter((l) => l.code !== current.code);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("[data-lang-button]")?.focus(); }
    };
    // Focus sur la premiere langue du cylindre, une fois qu'il est descendu.
    const focusTimer = setTimeout(() => items()[0]?.focus(), 120);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(focusTimer); document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function choose(code: string) {
    setOpen(false);
    if (code !== locale) router.replace(pathname, { locale: code });
  }

  return (
    <div ref={root} className="lang-switcher" data-open={open || undefined}>
      {/* Le cylindre descend derriere la bulle : meme largeur, il part de son centre. */}
      <div
        role="menu"
        aria-label="Langue"
        aria-hidden={!open}
        className="lang-cylinder"
        data-lang-menu=""
        onKeyDown={(e) => {
          const list = items();
          const at = list.indexOf(document.activeElement as HTMLButtonElement);
          const next = e.key === "ArrowDown" ? (at + 1) % list.length : e.key === "ArrowUp" ? (at - 1 + list.length) % list.length : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : -1;
          if (next >= 0) { e.preventDefault(); list[next]?.focus(); }
        }}
      >
        {others.map((l, i) => (
          <button
            key={l.code}
            type="button"
            role="menuitemradio"
            aria-checked={false}
            aria-label={l.name}
            title={l.name}
            tabIndex={open ? 0 : -1}
            onClick={() => choose(l.code)}
            className={`lang-bubble`}
            style={{ transitionDelay: open ? `${80 + i * 60}ms` : "0ms" }}
            data-lang={l.code}
          >
            {l.short}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Langue : ${current.name}`}
        title={current.name}
        className={`lang-bubble lang-switcher-button`}
        data-lang-button={current.code}
      >
        {current.short}
      </button>
    </div>
  );
}
