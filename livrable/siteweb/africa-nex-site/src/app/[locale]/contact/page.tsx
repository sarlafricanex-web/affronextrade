"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";

export default function ContactPage() {
  const t = useTranslations("contact");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, string> = {};
    fd.forEach((v, k) => { if (k !== "bot-field" && k !== "consent") body[k] = String(v); });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ paddingTop: "3.5rem" }}>
        <section
          className="flex flex-col items-center justify-center text-center"
          style={{ padding: "var(--section-gap) var(--page-margin)", minHeight: "60svh" }}
        >
          <Reveal>
            <div
              className="w-16 h-16 flex items-center justify-center mb-6 mx-auto"
              style={{ background: "var(--accent)", borderRadius: "50%" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </Reveal>
          <Reveal delay={1}>
            <h1
              className="font-extrabold"
              style={{ fontSize: "var(--step-title)", lineHeight: 0.95 }}
            >
              {t("successTitle")}
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4" style={{ color: "var(--muted)", maxWidth: "40ch" }}>
              {t("successMessage")}
            </p>
          </Reveal>
        </section>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h1
            className="font-extrabold"
            style={{ fontSize: "var(--step-display)", lineHeight: 0.92, letterSpacing: "-0.03em", maxWidth: "16ch" }}
          >
            {t("title")}
          </h1>
        </Reveal>
        <Reveal delay={1}>
          <p className="mt-4" style={{ color: "var(--muted)" }}>{t("subtitle")}</p>
        </Reveal>
      </section>

      <section style={{ padding: "0 var(--page-margin) var(--section-gap)" }}>
        <div className="grid lg:grid-cols-5 gap-16">
          <form
            className="lg:col-span-3 space-y-5"
            onSubmit={handleSubmit}
          >
            <p className="hidden">
              <label>
                Ne remplissez pas : <input name="bot-field" />
              </label>
            </p>

            <Reveal>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("name")}</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("email")}</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
              </div>
            </Reveal>

            <Reveal delay={1}>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("company")}</label>
                  <input
                    name="company"
                    type="text"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("country")}</label>
                  <input
                    name="country"
                    type="text"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("phoneField")}</label>
                  <input
                    name="phone"
                    type="tel"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                    placeholder="+213 ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("whatsapp")}</label>
                  <input
                    name="whatsapp"
                    type="tel"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                    placeholder="+213 ..."
                  />
                </div>
              </div>
            </Reveal>

            <Reveal delay={3}>
              <div>
                <label className="block text-sm font-medium mb-1">{t("message")}</label>
                <textarea
                  name="message"
                  rows={5}
                  className="w-full px-4 py-3 text-sm resize-none"
                  style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                />
              </div>
            </Reveal>

            <Reveal delay={4}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  name="consent"
                  type="checkbox"
                  required
                  className="mt-1 shrink-0"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {t("consent")}{" "}
                  <Link href="/legal" className="underline" style={{ color: "var(--ink)" }}>
                    {t("privacyLink")}
                  </Link>
                </span>
              </label>
            </Reveal>

            {error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>
                {t("errorMessage")}
              </p>
            )}

            <Reveal delay={4}>
              <button
                type="submit"
                disabled={sending}
                className="text-sm font-semibold px-8 py-3 disabled:opacity-50"
                style={{ background: "var(--ink)", color: "var(--ground)" }}
              >
                {sending ? "Envoi..." : t("send")}
              </button>
            </Reveal>
          </form>

          <div className="lg:col-span-2">
            <Reveal>
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                    {t("address")}
                  </p>
                  <p className="text-sm leading-relaxed">
                    SARL AFRICA NEX<br />
                    Cite 50 LSP + 18, Locaux RDC<br />
                    Batiment 4, Bloc 1, n 52<br />
                    Setif, Algerie
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                    {t("phone")}
                  </p>
                  <a href="tel:+213770960270" className="text-sm hover:underline">0770 96 02 70</a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                    WhatsApp
                  </p>
                  <a href="https://wa.me/213770960270" className="text-sm hover:underline" target="_blank" rel="noopener noreferrer">0770 96 02 70</a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                    {t("emailLabel")}
                  </p>
                  <a href="mailto:sarlafricanex@gmail.com" className="text-sm hover:underline">sarlafricanex@gmail.com</a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
