"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslations } from "next-intl";

// Sans htmlFor, le libelle entoure le champ. Avec htmlFor, il le designe par son id : a utiliser
// quand le champ contient un bouton (sinon le libelle du bouton s'ajouterait au nom du champ).
export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  const caption = (
    <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>
      {label}
    </span>
  );
  const header = (labelled: ReactNode) => (
    <span className="flex items-baseline justify-between gap-4">
      {labelled}
      {hint && <span className="text-xs" style={{ color: "var(--muted)" }}>{hint}</span>}
    </span>
  );

  if (htmlFor) {
    return (
      <div className="flex flex-col gap-2">
        {header(<label htmlFor={htmlFor}>{caption}</label>)}
        {children}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-2">
      {header(caption)}
      {children}
    </label>
  );
}

const inputStyle = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full px-4 py-3 text-sm" style={inputStyle} />;
}

// Champ mot de passe avec un bouton oeil pour afficher ou masquer la saisie.
// Toujours de gauche a droite (comme le telephone) : en arabe, "Sahara2026!" s'afficherait
// sinon "!Sahara2026" une fois rendu visible.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const label = visible ? t("hidePassword") : t("showPassword");

  return (
    <span className="relative block" dir="ltr">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="w-full py-3 text-sm"
        style={{ ...inputStyle, paddingInlineStart: "1rem", paddingInlineEnd: "3rem" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 flex items-center justify-center"
        style={{ insetInlineEnd: 0, width: "3rem", color: "var(--muted)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {visible ? (
            <>
              <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9" />
              <path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.6" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              <path d="M2 2l20 20" />
            </>
          ) : (
            <>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}

// Confirmation du mot de passe : la faute de frappe est signalee sous le champ des qu'elle
// apparait (debut different, ou champ quitte), jamais pendant une saisie encore correcte.
// forceCheck : apres un envoi, l'ecart s'affiche meme si la saisie est incomplete.
export function ConfirmPasswordField({
  id,
  password,
  value,
  onChange,
  forceCheck,
}: {
  id: string;
  password: string;
  value: string;
  onChange: (value: string) => void;
  forceCheck: boolean;
}) {
  const t = useTranslations("auth");
  const [left, setLeft] = useState(false);
  const mismatch = value !== password && (forceCheck || (value.length > 0 && (left || !password.startsWith(value))));
  const errorId = `${id}-error`;

  return (
    <Field label={t("confirmPassword")} htmlFor={id}>
      <PasswordInput
        id={id}
        autoComplete="new-password"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setLeft(true)}
        aria-invalid={mismatch || undefined}
        aria-describedby={mismatch ? errorId : undefined}
      />
      {mismatch && (
        <span id={errorId} className="text-xs font-semibold" style={{ color: "#dc2626" }}>
          {t("errorMismatch")}
        </span>
      )}
    </Field>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-4 text-sm font-bold uppercase transition-opacity disabled:opacity-60"
      style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
    >
      {children}
    </button>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const border = tone === "error" ? "#dc2626" : "var(--accent)";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className="px-4 py-3 text-sm"
      style={{ border: `1px solid ${border}`, background: "white", color: tone === "error" ? "#dc2626" : "var(--ink)" }}
    >
      {children}
    </p>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 text-xs font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
      <span className="flex-1" style={{ height: 1, background: "var(--field-b)" }} />
      {label}
      <span className="flex-1" style={{ height: 1, background: "var(--field-b)" }} />
    </div>
  );
}
