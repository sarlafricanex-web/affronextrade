"use client";

import {
  Fragment,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { regionName } from "@/lib/countries";

// L'Algerie puis les 8 marches prioritaires d'AFRICA NEX, en tete de liste.
export const SUGGESTED: CountryCode[] = ["DZ", "NG", "CI", "SN", "ET", "GH", "CM", "KE", "CF"];

type Option = { code: CountryCode; dial: string; name: string; search: string };

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Flag({ code, lazy }: { code: CountryCode; lazy?: boolean }) {
  return (
    // Petites images SVG locales (public/flags) : next/image n'apporterait rien ici.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code}.svg`}
      alt=""
      width={24}
      height={16}
      loading={lazy ? "lazy" : undefined}
      className="shrink-0"
      style={{ width: 24, height: 16, objectFit: "cover", outline: "1px solid rgba(15, 23, 42, 0.12)" }}
    />
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="shrink-0" style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Liste des pays (drapeau, nom traduit, indicatif si showDial) avec recherche, sous le champ anchorRef.
 * A monter seulement quand elle est ouverte : recherche et surbrillance repartent de zero a chaque fois.
 * Les noms sont calcules dans le navigateur (jamais au rendu serveur : les donnees Intl peuvent
 * differer entre Node et le navigateur).
 */
export function CountryListPopup({
  listId,
  anchorRef,
  triggerRef,
  initialRect,
  selected,
  showDial,
  onChoose,
  onClose,
}: {
  listId: string;
  anchorRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  initialRect: DOMRect;
  selected: CountryCode | null;
  showDial: boolean;
  onChoose: (code: CountryCode) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const t = useTranslations("phone");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [rect, setRect] = useState(initialRect);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // La recherche accepte aussi les noms francais et anglais : en arabe, "senegal" trouve le Senegal,
  // et en francais "ivory coast" trouve la Cote d'Ivoire.
  const allOptions = useMemo<Option[]>(() => {
    const collator = new Intl.Collator(locale);
    return getCountries()
      .map((code) => {
        const name = regionName(locale, code);
        const aliases = [regionName("fr", code), regionName("en", code), code];
        return { code, dial: getCountryCallingCode(code), name, search: normalize([name, ...aliases].join(" ")) };
      })
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [locale]);

  const trimmed = query.trim();
  const numericQuery = showDial && /^\+?\d+$/.test(trimmed) ? trimmed.replace("+", "") : "";
  const matches = !trimmed
    ? null
    : allOptions.filter((o) => (numericQuery ? o.dial.startsWith(numericQuery) : o.search.includes(normalize(trimmed))));
  const suggested = matches ? [] : SUGGESTED.map((code) => allOptions.find((o) => o.code === code)).filter((o): o is Option => Boolean(o));
  const items = matches ?? [...suggested, ...allOptions];
  const activeIndex = active ?? Math.max(items.findIndex((o) => o.code === selected), 0);

  // Clic hors de la liste et du bouton qui l'ouvre : on ferme (le bouton gere lui-meme l'alternance).
  const onOutside = useEffectEvent((event: PointerEvent) => {
    const target = event.target as Node;
    if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
    onClose(false);
  });

  useEffect(() => {
    const follow = () => {
      const next = anchorRef.current?.getBoundingClientRect();
      if (next) setRect(next);
    };
    const outside = (event: PointerEvent) => onOutside(event);
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [anchorRef]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, last),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: last,
      PageDown: Math.min(activeIndex + 8, last),
      PageUp: Math.max(activeIndex - 8, 0),
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (items[activeIndex]) onChoose(items[activeIndex].code);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "Tab") {
      onClose(false);
    }
  }

  // Ouverture vers le haut quand la place manque sous le champ (bas d'ecran, clavier mobile).
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  const upward = below < 280 && above > below;
  const width = Math.min(Math.max(rect.width, 288), window.innerWidth - 16);
  const style: CSSProperties = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    width,
    maxHeight: Math.max(160, Math.min(352, (upward ? above : below) - 12)),
    ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    background: "white",
    border: "1px solid var(--field-b)",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
  };

  return createPortal(
    <div ref={popupRef} dir={locale === "ar" ? "rtl" : "ltr"} className="fixed z-[60] flex flex-col" style={style}>
      <div className="p-2" style={{ borderBottom: "1px solid var(--field-b)" }}>
        <input
          ref={searchRef}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-label={showDial ? t("search") : t("searchCountry")}
          placeholder={showDial ? t("search") : t("searchCountry")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeys}
          className="w-full px-3 py-2 text-sm"
          style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
        />
      </div>
      <ul id={listId} role="listbox" aria-label={showDial ? t("listLabel") : t("countries")} className="flex-1 overflow-y-auto py-1">
        {items.map((option, index) => (
          <Fragment key={`${index < suggested.length ? "s" : "a"}-${option.code}`}>
            {suggested.length > 0 && (index === 0 || index === suggested.length) && (
              <li role="presentation" className="px-3 pt-3 pb-1 text-xs font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>
                {index === 0 ? t("suggested") : t("allCountries")}
              </li>
            )}
            <li
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.code === selected}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => onChoose(option.code)}
              onMouseMove={() => index !== activeIndex && setActive(index)}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
              style={{ background: index === activeIndex ? "var(--field-a)" : "transparent" }}
            >
              <Flag code={option.code} lazy />
              <span className="min-w-0 flex-1 truncate" style={{ fontWeight: option.code === selected ? 700 : 400 }}>
                {option.name}
              </span>
              {showDial && (
                <span dir="ltr" className="shrink-0" style={{ color: "var(--muted)" }}>
                  +{option.dial}
                </span>
              )}
            </li>
          </Fragment>
        ))}
        {items.length === 0 && (
          <li role="presentation" className="px-3 py-4 text-sm" style={{ color: "var(--muted)" }}>
            {t("noResult")}
          </li>
        )}
      </ul>
    </div>,
    document.body,
  );
}
