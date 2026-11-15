import { getTranslations } from "next-intl/server";
import type { RfqLine } from "@/lib/data/rfq";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Produits demandes dans une demande de devis (fiche acheteur et console AFRICA NEX).
export async function RfqLinesTable({ lines, locale, currency }: { lines: RfqLine[]; locale: string; currency: string | null }) {
  const [t, tc] = await Promise.all([getTranslations({ locale, namespace: "rfq" }), getTranslations({ locale, namespace: "catalog" })]);
  if (!lines.length) return null;
  return (
    <section style={{ background: "white", border: `1px solid ${HAIR}` }} aria-labelledby="rfq-lines-title" data-rfq-lines={lines.length}>
      <h2 id="rfq-lines-title" className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
        <span>{t("linesTitle", { count: lines.length })}</span>
        {currency && <span style={{ color: "var(--muted)" }}>{t("wishedCurrency", { currency })}</span>}
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-sm" style={{ minWidth: 520 }}>
          <thead>
            <tr className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
              <th className="px-4 py-2 text-start">#</th>
              <th className="px-4 py-2 text-start">{t("lineDescription")}</th>
              <th className="px-4 py-2 text-start">{t("lineReference")}</th>
              <th className="px-4 py-2 text-end">{t("quantity")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} style={{ borderTop: `1px solid ${HAIR}` }} data-line-position={l.position}>
                <td className="px-4 py-2 font-bold">{l.position}</td>
                <td className="px-4 py-2 font-semibold">{l.description}</td>
                <td className="px-4 py-2" dir="ltr" style={{ textAlign: "start", color: l.reference ? "var(--ink)" : "var(--muted)" }}>{l.reference ?? "-"}</td>
                <td className="px-4 py-2 text-end whitespace-nowrap" dir="ltr">
                  {l.quantity != null ? `${Number(l.quantity).toLocaleString(locale)} ${l.unit ? tc(`unitShort_${l.unit}`) : ""}`.trim() : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
