"use client";

import { useTranslations } from "next-intl";

const ARGUMENTS = ["Buyers", "Cagex", "Support"] as const;

export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section style={{ padding: "clamp(1.5rem, 5vw, 4rem) var(--page-margin)" }}>
        <div className="mx-auto grid md:grid-cols-5" style={{ maxWidth: 1100, border: "1px solid var(--field-b)" }}>
          <aside
            className="hidden md:flex md:col-span-2 flex-col"
            style={{ background: "var(--ink)", color: "white", padding: "3rem 2.5rem" }}
          >
            <p className="font-extrabold" style={{ fontSize: "1.75rem", letterSpacing: "-0.025em" }}>AFRICA NEX</p>
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--accent)", letterSpacing: "0.2em" }}>
              TRADING MADE EASY
            </p>
            <div className="mt-6" style={{ width: 56, height: 2, background: "var(--accent)" }} />
            <p className="mt-10 font-extrabold" style={{ fontSize: "1.6rem", lineHeight: 1.2, letterSpacing: "-0.02em", maxWidth: "22ch" }}>
              {t("panelTagline")}
            </p>
            <ul className="mt-10 flex flex-col gap-7">
              {ARGUMENTS.map((key) => (
                <li key={key} style={{ borderInlineStart: "2px solid var(--accent)", paddingInlineStart: "1rem" }}>
                  <p className="text-sm font-bold uppercase" style={{ letterSpacing: "0.06em" }}>{t(`arg${key}Title`)}</p>
                  <p className="mt-1 text-sm" style={{ color: "rgba(255, 255, 255, 0.72)" }}>{t(`arg${key}Text`)}</p>
                </li>
              ))}
            </ul>
          </aside>
          <div className="md:col-span-3" style={{ background: "var(--ground)", padding: "clamp(1.5rem, 4vw, 3.5rem)" }}>
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
