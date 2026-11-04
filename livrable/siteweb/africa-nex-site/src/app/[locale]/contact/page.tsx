"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "@/components/Reveal";

export default function ContactPage() {
  const t = useTranslations("contact");

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
            onSubmit={(e) => e.preventDefault()}
          >
            <Reveal>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("name")}</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("email")}</label>
                  <input
                    type="email"
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
                    type="text"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("country")}</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 text-sm"
                    style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                  />
                </div>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <div>
                <label className="block text-sm font-medium mb-1">{t("message")}</label>
                <textarea
                  rows={5}
                  className="w-full px-4 py-3 text-sm resize-none"
                  style={{ background: "var(--field-a)", border: "none", outline: "none" }}
                />
              </div>
            </Reveal>

            <Reveal delay={3}>
              <button
                type="submit"
                className="text-sm font-semibold px-8 py-3"
                style={{ background: "var(--ink)", color: "var(--ground)" }}
              >
                {t("send")}
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
                    {t("emailLabel")}
                  </p>
                  <a href="mailto:contact@africanex.com" className="text-sm hover:underline">contact@africanex.com</a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
