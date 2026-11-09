"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>
          {label}
        </span>
        {hint && <span className="text-xs" style={{ color: "var(--muted)" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 text-sm"
      style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }}
    />
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
