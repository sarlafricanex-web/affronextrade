"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import { isValidPhone } from "@/lib/phone";

// L'Algerie puis les 8 marches prioritaires d'AFRICA NEX, en tete de liste.
const SUGGESTED: CountryCode[] = ["DZ", "NG", "CI", "SN", "ET", "GH", "CM", "KE", "CF"];

type Option = { code: CountryCode; dial: string; name: string; search: string };

// Format international sans espaces (+213555123456) : celui de WhatsApp et des SMS.
function toE164(country: CountryCode, national: string) {
  const digits = national.replace(/\D/g, "");
  if (!digits) return "";
  return parsePhoneNumberFromString(national, country)?.number ?? `+${getCountryCallingCode(country)}${digits.replace(/^0+/, "")}`;
}

// Partie nationale affichee a cote de l'indicatif : "555 12 34 56" plutot que "0555 12 34 56".
function nationalDisplay(international: string, dial: string) {
  return international.replace(`+${dial}`, "").trim();
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function initialState(defaultValue: string | undefined, fallback: CountryCode) {
  const parsed = defaultValue ? parsePhoneNumberFromString(defaultValue) : undefined;
  if (parsed?.country) {
    return { country: parsed.country, national: nationalDisplay(parsed.formatInternational(), parsed.countryCallingCode) };
  }
  return { country: fallback, national: "" };
}

function Flag({ code, lazy }: { code: CountryCode; lazy?: boolean }) {
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

/**
 * Telephone international : bouton drapeau + indicatif, puis numero national.
 * - name : ajoute un champ cache portant le numero au format +213555123456 (formulaires classiques).
 * - onChange : recoit ce meme numero a chaque modification (formulaires React).
 * Un numero invalide bloque l'envoi natif du formulaire (setCustomValidity) et s'affiche en rouge
 * une fois le champ quitte, ou des l'envoi si forceCheck.
 */
export function PhoneField({
  id,
  name,
  defaultValue,
  onChange,
  defaultCountry = "DZ",
  forceCheck = false,
  fieldStyle,
}: {
  id: string;
  name?: string;
  defaultValue?: string;
  onChange?: (e164: string) => void;
  defaultCountry?: CountryCode;
  forceCheck?: boolean;
  fieldStyle?: CSSProperties;
}) {
  const t = useTranslations("phone");
  const locale = useLocale();
  const [{ country, national }, setState] = useState(() => initialState(defaultValue, defaultCountry));
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const errorId = `${id}-error`;

  const dial = getCountryCallingCode(country);
  const e164 = toE164(country, national);
  const invalid = e164 !== "" && !isValidPhone(e164);
  const showError = invalid && (touched || forceCheck);
  const example = getExampleNumber(country, examples);
  const placeholder = example ? nationalDisplay(example.formatInternational(), dial) : undefined;

  // Noms de pays dans la langue de la page, calcules seulement a l'ouverture (jamais au rendu
  // serveur : les donnees Intl peuvent differer entre Node et le navigateur).
  const allOptions = useMemo<Option[] | null>(() => {
    if (!open) return null;
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const collator = new Intl.Collator(locale);
    return getCountries()
      .map((code) => {
        let label: string = code;
        try {
          label = names.of(code) ?? code;
        } catch {}
        return { code, dial: getCountryCallingCode(code), name: label, search: normalize(`${label} ${code}`) };
      })
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [open, locale]);

  const trimmed = query.trim();
  const numericQuery = /^\+?\d+$/.test(trimmed) ? trimmed.replace("+", "") : "";
  const matches = !allOptions || !trimmed
    ? null
    : allOptions.filter((o) => (numericQuery ? o.dial.startsWith(numericQuery) : o.search.includes(normalize(trimmed))));
  const suggested = allOptions && !matches ? SUGGESTED.map((code) => allOptions.find((o) => o.code === code)!).filter(Boolean) : [];
  const items = matches ?? [...suggested, ...(allOptions ?? [])];
  const selectedIndex = items.findIndex((o) => o.code === country);
  const activeIndex = active ?? Math.max(selectedIndex, 0);

  // Le navigateur refuse l'envoi d'un formulaire classique tant que le numero est invalide.
  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? t("invalid") : "");
  }, [invalid, t]);

  // Liste ouverte : suit le champ au defilement, se ferme au clic exterieur.
  useEffect(() => {
    if (!open) return;
    const follow = () => setRect(fieldRef.current?.getBoundingClientRect() ?? null);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
      setActive(null);
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    document.addEventListener("pointerdown", outside);
    searchRef.current?.focus();
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  function update(nextCountry: CountryCode, nextNational: string) {
    setState({ country: nextCountry, national: nextNational });
    onChange?.(toE164(nextCountry, nextNational));
  }

  function handleInput(raw: string) {
    let value = raw.replace(/[^\d+()\-.\s]/g, "");
    if (value.startsWith("00")) value = `+${value.slice(2)}`;
    // Numero colle ou saisi au format international : le pays suit l'indicatif.
    if (value.startsWith("+")) {
      const typer = new AsYouType();
      typer.input(value);
      const detected = typer.getCountry();
      if (detected) return update(detected, typer.getNationalNumber());
    }
    update(country, value);
  }

  function handleBlur() {
    setTouched(true);
    const parsed = parsePhoneNumberFromString(national, country);
    if (parsed?.isValid()) update(parsed.country ?? country, nationalDisplay(parsed.formatInternational(), parsed.countryCallingCode));
  }

  function openList() {
    setRect(fieldRef.current?.getBoundingClientRect() ?? null);
    setActive(null);
    setQuery("");
    setOpen(true);
  }

  function closeList(restoreFocus: boolean) {
    setOpen(false);
    setQuery("");
    setActive(null);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function choose(code: CountryCode) {
    update(code, national);
    closeList(false);
    inputRef.current?.focus();
  }

  function handleSearchKeys(event: KeyboardEvent<HTMLInputElement>) {
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
      if (items[activeIndex]) choose(items[activeIndex].code);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeList(true);
    } else if (event.key === "Tab") {
      closeList(false);
    }
  }

  // Ouverture vers le haut quand la place manque sous le champ (bas d'ecran, clavier mobile).
  const below = rect ? window.innerHeight - rect.bottom : 0;
  const above = rect ? rect.top : 0;
  const upward = below < 280 && above > below;
  const popupWidth = rect ? Math.min(Math.max(rect.width, 288), window.innerWidth - 16) : 0;
  const popupStyle: CSSProperties | undefined = rect
    ? {
        left: Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 8)),
        width: popupWidth,
        maxHeight: Math.max(160, Math.min(352, (upward ? above : below) - 12)),
        ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        background: "white",
        border: "1px solid var(--field-b)",
        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
      }
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      {/* Indicatif et numero se lisent toujours de gauche a droite, y compris en arabe. */}
      <div
        ref={fieldRef}
        dir="ltr"
        className="flex items-stretch"
        style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", ...fieldStyle }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? closeList(false) : openList())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={t("countryCode", { code: `+${dial}` })}
          className="flex shrink-0 items-center gap-2 py-3 ps-3 pe-2"
          style={{ borderInlineEnd: "1px solid var(--field-b)" }}
        >
          <Flag code={country} />
          <span className="text-sm font-semibold">+{dial}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : undefined }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          placeholder={placeholder}
          onChange={(event) => handleInput(event.target.value)}
          onBlur={handleBlur}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm"
          style={{ outline: "none", border: "none" }}
        />
      </div>
      {name && <input type="hidden" name={name} value={e164} />}
      {showError && (
        <span id={errorId} className="text-xs font-semibold" style={{ color: "#dc2626" }}>
          {t("invalid")}
        </span>
      )}

      {open && popupStyle &&
        createPortal(
          <div ref={popupRef} dir={locale === "ar" ? "rtl" : "ltr"} className="fixed z-[60] flex flex-col" style={popupStyle}>
            <div className="p-2" style={{ borderBottom: "1px solid var(--field-b)" }}>
              <input
                ref={searchRef}
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
                aria-label={t("search")}
                placeholder={t("search")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={handleSearchKeys}
                className="w-full px-3 py-2 text-sm"
                style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
              />
            </div>
            <ul id={listId} role="listbox" aria-label={t("listLabel")} className="flex-1 overflow-y-auto py-1">
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
                    aria-selected={option.code === country}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.code)}
                    onMouseMove={() => index !== activeIndex && setActive(index)}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                    style={{ background: index === activeIndex ? "var(--field-a)" : "transparent" }}
                  >
                    <Flag code={option.code} lazy />
                    <span className="min-w-0 flex-1 truncate" style={{ fontWeight: option.code === country ? 700 : 400 }}>
                      {option.name}
                    </span>
                    <span dir="ltr" className="shrink-0" style={{ color: "var(--muted)" }}>
                      +{option.dial}
                    </span>
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
        )}
    </div>
  );
}
