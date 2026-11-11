"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DeleteProductButton } from "./DeleteProductButton";

// Tableau du catalogue d'apres la maquette Stitch 06 : recherche et filtre de statut dans le navigateur.
export type CatalogRow = {
  id: string;
  name: string;
  description: string | null;
  photo: string | null;
  hsCode: string | null;
  price: string | null;
  priceBasis: string | null;
  moq: string | null;
  packaging: string | null;
  stock: string | null;
  status: "published" | "draft";
};

const HAIR = "#d8cebb";
const head = "px-4 py-3 text-start text-[11px] font-bold uppercase whitespace-nowrap";
const caps = { letterSpacing: "0.08em", color: "var(--muted)" } as const;
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function CatalogTable({ rows }: { rows: CatalogRow[] }) {
  const c = useTranslations("catalog");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return rows.filter((r) => (status === "all" || r.status === status) && (!q || fold(`${r.name} ${r.hsCode ?? ""} ${r.description ?? ""}`).includes(q)));
  }, [rows, query, status]);

  return (
    <div style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" style={{ background: "#fff8f3", borderBottom: `1px solid ${HAIR}` }}>
        <label className="flex flex-1 items-center gap-2 px-3 py-2" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: "var(--muted)" }}><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" /></svg>
          <span className="sr-only">{c("searchLabel")}</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c("searchPlaceholder")} className="w-full bg-transparent text-sm" style={{ border: 0, outline: "none" }} />
        </label>
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase" style={caps}>
          {c("filterStatus")}
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="px-3 py-2 text-sm normal-case" style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--ink)", letterSpacing: 0 }}>
            <option value="all">{c("filterAll")}</option>
            <option value="published">{c("status_published")}</option>
            <option value="draft">{c("status_draft")}</option>
          </select>
        </label>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr style={{ background: "#ece3d4", borderBottom: `1px solid ${HAIR}` }}>
              <th scope="col" className={head} style={caps}>{c("colRef")}</th>
              <th scope="col" className={head} style={caps}>{c("colProduct")}</th>
              <th scope="col" className={head} style={caps}>{c("colHs")}</th>
              <th scope="col" className={`${head} text-end`} style={caps}>{c("colPrice")}</th>
              <th scope="col" className={`${head} text-end`} style={caps}>{c("colMoqPack")}</th>
              <th scope="col" className={`${head} text-end`} style={caps}>{c("colStock")}</th>
              <th scope="col" className={head} style={caps}>{c("colStatus")}</th>
              <th scope="col" className={head} style={caps}><span className="sr-only">{c("colActions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} className="align-top" style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td className="px-4 py-4 font-semibold" style={{ color: "var(--muted)", fontFeatureSettings: '"tnum" 1' }}>{String(i + 1).padStart(2, "0")}</td>
                <td className="px-4 py-4" style={{ minWidth: 280 }}>
                  <div className="flex items-start gap-3">
                    {r.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo} alt="" className="h-14 w-14 shrink-0 object-cover" style={{ border: `1px solid ${HAIR}` }} />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center text-[10px] font-bold uppercase" style={{ background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{c("noPhoto")}</span>
                    )}
                    <div className="min-w-0">
                      <Link href={`/catalog/${r.id}`} className="font-bold hover:underline" style={{ color: "var(--ink)" }}>{r.name}</Link>
                      {r.description && <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted)", maxWidth: "38ch" }}>{r.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-semibold" dir="ltr" style={{ fontFeatureSettings: '"tnum" 1' }}>{r.hsCode ?? <span style={{ color: "#f97316" }}>{c("missing")}</span>}</td>
                <td className="px-4 py-4 text-end whitespace-nowrap">
                  {r.price ? (
                    <>
                      <span className="block font-bold" style={{ fontFeatureSettings: '"tnum" 1' }}>{r.price}</span>
                      {r.priceBasis && <span className="text-xs" style={{ color: "var(--muted)" }}>{r.priceBasis}</span>}
                    </>
                  ) : <span style={{ color: "#f97316" }}>{c("missing")}</span>}
                </td>
                <td className="px-4 py-4 text-end">
                  <span className="block whitespace-nowrap font-semibold" style={{ fontFeatureSettings: '"tnum" 1' }}>{r.moq ?? "-"}</span>
                  {r.packaging && <span className="text-xs" style={{ color: "var(--muted)" }}>{r.packaging}</span>}
                </td>
                <td className="px-4 py-4 text-end whitespace-nowrap" style={{ fontFeatureSettings: '"tnum" 1' }}>{r.stock ?? <span style={{ color: "var(--muted)" }}>-</span>}</td>
                <td className="px-4 py-4">
                  <span
                    className="inline-block px-2 py-1 text-[10px] font-bold uppercase whitespace-nowrap"
                    style={{ letterSpacing: "0.08em", ...(r.status === "published" ? { background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" } : { background: "#fff7ed", border: "1px solid #f97316", color: "#9a3412" }) }}
                  >
                    {c(`status_${r.status}`)}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-4">
                    <Link href={`/catalog/${r.id}`} className="text-xs font-bold uppercase" style={{ color: "var(--ink)", letterSpacing: "0.08em" }}>{c("edit")}</Link>
                    <DeleteProductButton id={r.id} name={r.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="p-8 text-center" style={{ color: "var(--muted)" }}>{c("noMatch")}</p>}
      <p className="px-4 py-3 text-[11px] font-bold uppercase" style={{ ...caps, borderTop: `1px solid ${HAIR}` }}>{c("tableTotal", { shown: shown.length, total: rows.length })}</p>
    </div>
  );
}
