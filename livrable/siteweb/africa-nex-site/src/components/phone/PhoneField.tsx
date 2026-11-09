"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { AsYouType, getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import { Chevron, CountryListPopup, Flag } from "@/components/country/CountryList";
import { isValidPhone } from "@/lib/phone";

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

function initialState(defaultValue: string | undefined) {
  const parsed = defaultValue ? parsePhoneNumberFromString(defaultValue) : undefined;
  if (parsed?.country) {
    return { chosen: parsed.country, national: nationalDisplay(parsed.formatInternational(), parsed.countryCallingCode) };
  }
  return { chosen: null as CountryCode | null, national: "" };
}

/**
 * Telephone international : bouton drapeau + indicatif, puis numero national.
 * - name : ajoute un champ cache portant le numero au format +213555123456 (formulaires classiques).
 * - onChange : recoit ce meme numero a chaque modification (formulaires React).
 * - suggestedCountry : pays propose tant que la personne n'a ni choisi de pays ni saisi de numero
 *   (par exemple le champ Pays du meme formulaire).
 * Un numero invalide, ou absent si required, bloque l'envoi natif du formulaire (setCustomValidity)
 * et s'affiche en rouge une fois le champ quitte, ou des l'envoi si forceCheck.
 */
export function PhoneField({
  id,
  name,
  defaultValue,
  onChange,
  defaultCountry = "DZ",
  suggestedCountry,
  required = false,
  forceCheck = false,
  fieldStyle,
}: {
  id: string;
  name?: string;
  defaultValue?: string;
  onChange?: (e164: string) => void;
  defaultCountry?: CountryCode;
  suggestedCountry?: CountryCode | null;
  required?: boolean;
  forceCheck?: boolean;
  fieldStyle?: CSSProperties;
}) {
  const t = useTranslations("phone");
  const [{ chosen, national }, setState] = useState(() => initialState(defaultValue));
  const [touched, setTouched] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const errorId = `${id}-error`;

  const country = chosen ?? suggestedCountry ?? defaultCountry;
  const dial = getCountryCallingCode(country);
  const e164 = toE164(country, national);
  const error = e164 && !isValidPhone(e164) ? t("invalid") : required && !e164 ? t("required") : "";
  const showError = Boolean(error) && (touched || forceCheck);
  const example = getExampleNumber(country, examples);
  const placeholder = example ? nationalDisplay(example.formatInternational(), dial) : undefined;
  const open = anchorRect !== null;

  // Le navigateur refuse l'envoi d'un formulaire classique tant que le numero pose probleme.
  useEffect(() => {
    inputRef.current?.setCustomValidity(error);
  }, [error]);

  function update(nextChosen: CountryCode | null, nextNational: string) {
    setState({ chosen: nextChosen, national: nextNational });
    onChange?.(toE164(nextChosen ?? suggestedCountry ?? defaultCountry, nextNational));
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
    // Des le premier chiffre, le pays affiche est fige : il ne suit plus le champ Pays.
    update(chosen ?? (value.trim() ? country : null), value);
  }

  function handleBlur() {
    setTouched(true);
    const parsed = parsePhoneNumberFromString(national, country);
    if (parsed?.isValid()) update(parsed.country ?? country, nationalDisplay(parsed.formatInternational(), parsed.countryCallingCode));
  }

  function closeList(restoreFocus: boolean) {
    setAnchorRect(null);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function choose(code: CountryCode) {
    update(code, national);
    setAnchorRect(null);
    inputRef.current?.focus();
  }

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
          onClick={() => (open ? closeList(false) : setAnchorRect(fieldRef.current?.getBoundingClientRect() ?? null))}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={t("countryCode", { code: `+${dial}` })}
          className="flex shrink-0 items-center gap-2 py-3 ps-3 pe-2"
          style={{ borderInlineEnd: "1px solid var(--field-b)" }}
        >
          <Flag code={country} />
          <span className="text-sm font-semibold">+{dial}</span>
          <Chevron open={open} />
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
          aria-required={required || undefined}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm"
          style={{ outline: "none", border: "none" }}
        />
      </div>
      {name && <input type="hidden" name={name} value={e164} />}
      {showError && (
        <span id={errorId} className="text-xs font-semibold" style={{ color: "#dc2626" }}>
          {error}
        </span>
      )}
      {anchorRect && (
        <CountryListPopup
          listId={listId}
          anchorRef={fieldRef}
          triggerRef={triggerRef}
          initialRect={anchorRect}
          selected={country}
          showDial
          onChoose={choose}
          onClose={closeList}
        />
      )}
    </div>
  );
}
