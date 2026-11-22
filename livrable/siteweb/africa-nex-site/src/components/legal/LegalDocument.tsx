import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LEGAL_DOCS, getLegalSet, type LegalDocKey } from "@/content/legal";

const BASE_URL = "https://affronextrade.vercel.app";
const HAIR = "#d8cebb";

export function legalMetadata(locale: string, key: LegalDocKey): Metadata {
  const doc = getLegalSet(locale).docs[key];
  const path = LEGAL_DOCS.find((d) => d.key === key)!.path;
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${BASE_URL}/${l}${path}`]));
  return {
    title: `${doc.title} | AFRICA NEX`,
    description: doc.intro ?? doc.title,
    alternates: { canonical: `${BASE_URL}/${locale}${path}`, languages },
  };
}

// Document legal (mentions legales, confidentialite, CGU, CGV) : onglets entre les quatre documents,
// sections numerotees, date de mise a jour.
export function LegalDocument({ locale, docKey }: { locale: string; docKey: LegalDocKey }) {
  const set = getLegalSet(locale);
  const doc = set.docs[docKey];
  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section style={{ padding: "var(--section-gap) var(--page-margin) 2rem" }}>
        <nav aria-label="Documents" className="mb-8 flex flex-wrap gap-2" data-legal-nav="">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.key}
              href={d.path}
              aria-current={d.key === docKey ? "page" : undefined}
              className="px-3 py-2 text-xs font-bold uppercase"
              style={{ letterSpacing: "0.06em", border: `1px solid ${d.key === docKey ? "var(--ink)" : HAIR}`, background: d.key === docKey ? "var(--ink)" : "white", color: d.key === docKey ? "white" : "var(--ink)" }}
            >
              {set.docs[d.key].title}
            </Link>
          ))}
        </nav>
        <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1, letterSpacing: "-0.03em" }}>{doc.title}</h1>
        {doc.intro && <p className="mt-5 max-w-3xl leading-relaxed" style={{ color: "var(--muted)" }}>{doc.intro}</p>}
      </section>

      <section style={{ padding: "0 var(--page-margin) var(--section-gap)" }} data-legal-doc={docKey}>
        <div className="max-w-3xl space-y-9">
          {doc.sections.map((s) => (
            <div key={s.title} className="space-y-3">
              <h2 className="text-lg font-bold">{s.title}</h2>
              <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                {s.blocks.map((b, i) =>
                  Array.isArray(b) ? (
                    <ul key={i} className="list-disc space-y-1.5 ps-5">
                      {b.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p key={i}>{b}</p>
                  ),
                )}
              </div>
            </div>
          ))}
          <p className="pt-6 text-xs" style={{ color: "var(--muted)" }}>{set.updated}</p>
        </div>
      </section>
    </div>
  );
}
