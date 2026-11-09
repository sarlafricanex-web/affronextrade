"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import type { CountryCode } from "libphonenumber-js";
import { regionName } from "@/lib/countries";
import { Chevron, CountryListPopup, Flag } from "./CountryList";

/**
 * Choix d'un pays (drapeau + nom traduit). La valeur est le code ISO ("SN") : fiable pour les
 * statistiques, traduit a l'affichage. name ajoute un champ cache pour les formulaires classiques.
 * labelId : id du libelle visible, pour que le bouton s'annonce "Pays, Senegal".
 */
export function CountrySelect({
  id,
  name,
  labelId,
  defaultValue = null,
  onChange,
  placeholder,
  fieldStyle,
}: {
  id: string;
  name?: string;
  labelId?: string;
  defaultValue?: CountryCode | null;
  onChange?: (code: CountryCode) => void;
  placeholder: string;
  fieldStyle?: CSSProperties;
}) {
  const locale = useLocale();
  const [code, setCode] = useState<CountryCode | null>(defaultValue);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const open = anchorRect !== null;

  function closeList(restoreFocus: boolean) {
    setAnchorRect(null);
    if (restoreFocus) buttonRef.current?.focus();
  }

  function choose(next: CountryCode) {
    setCode(next);
    onChange?.(next);
    closeList(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => (open ? closeList(false) : setAnchorRect(buttonRef.current?.getBoundingClientRect() ?? null))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelId ? `${labelId} ${id}` : undefined}
        className="flex w-full items-center gap-3 px-4 py-3 text-start text-sm"
        style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", ...fieldStyle }}
      >
        {code ? (
          <>
            <Flag code={code} />
            <span className="min-w-0 flex-1 truncate">{regionName(locale, code)}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate" style={{ color: "var(--muted)" }}>
            {placeholder}
          </span>
        )}
        <Chevron open={open} />
      </button>
      {name && <input type="hidden" name={name} value={code ?? ""} />}
      {anchorRect && (
        <CountryListPopup
          listId={listId}
          anchorRef={buttonRef}
          triggerRef={buttonRef}
          initialRect={anchorRect}
          selected={code}
          showDial={false}
          onChoose={choose}
          onClose={closeList}
        />
      )}
    </>
  );
}
