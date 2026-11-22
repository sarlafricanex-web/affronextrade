"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type RequestRow = {
  id: string;
  reference: string;
  title: string;
  specs: string;
  volume: string;
  destination: string;
  incoterm: string | null;
  group: "todo" | "quoted" | "declined" | "expired";
  isNew: boolean;
  unread: number; // messages d'AFRICA NEX non lus (lot 5f)
  respondBy: string | null;
  hoursLeft: number | null;
};

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const GROUPS = ["todo", "quoted", "declined", "expired"] as const;

export function RequestList({ rows }: { rows: RequestRow[] }) {
  const t = useTranslations("requests");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("todo");
  const [query, setQuery] = useState("");
  const counts = Object.fromEntries(GROUPS.map((g) => [g, rows.filter((r) => r.group === g).length]));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => r.group === group && (!q || `${r.reference} ${r.title} ${r.destination}`.toLowerCase().includes(q)))
      .sort((a, b) => (a.hoursLeft ?? 1e9) - (b.hoursLeft ?? 1e9));
  }, [rows, group, query]);

  const due = (r: RequestRow) => (
    <>
      <span className="block font-semibold">{r.respondBy ?? "-"}</span>
      {r.group === "quoted" ? (
        <span className="block text-xs font-semibold" style={{ color: "#065f46" }}>{t("quoteSent")}</span>
      ) : r.group === "todo" && r.hoursLeft !== null ? (
        <span className="block text-xs font-semibold" style={{ color: r.hoursLeft < 72 ? "#c2410c" : "var(--muted)" }}>
          {r.hoursLeft < 72 ? t("hoursLeftUrgent", { hours: Math.max(r.hoursLeft, 0) }) : t("daysLeft", { days: Math.floor(r.hoursLeft / 24) })}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col" style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <div className="flex flex-wrap" role="tablist" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
        {GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className="flex items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ background: group === g ? "white" : "transparent", borderTop: `3px solid ${group === g ? "var(--ink)" : "transparent"}`, borderInlineEnd: `1px solid ${HAIR}` }}>
            {t(`tab_${g}`)}
            <span className="px-1.5 text-xs font-bold" style={{ background: g === "todo" && counts[g] ? "#c2410c" : "#e5d8c8", color: g === "todo" && counts[g] ? "white" : "var(--ink)" }}>{counts[g]}</span>
          </button>
        ))}
      </div>
      <div className="p-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="w-full px-4 py-2.5 text-sm md:max-w-md" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }} />
      </div>
      {shown.length === 0 ? (
        <p className="p-8 text-center" style={{ color: "var(--muted)" }}>{rows.length ? t("noneInTab") : t("empty")}</p>
      ) : (
        <>
          <table className="hidden w-full md:table" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", color: "var(--muted)" }}>
                <th className="px-4 py-3 text-start">{t("colRef")}</th>
                <th className="px-4 py-3 text-start">{t("colProduct")}</th>
                <th className="px-4 py-3 text-end">{t("colQuantity")}</th>
                <th className="px-4 py-3 text-start">{t("colDestination")}</th>
                <th className="px-4 py-3 text-start">{t("colIncoterm")}</th>
                <th className="px-4 py-3 text-start">{t("colDue")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${HAIR}`, opacity: r.group === "declined" || r.group === "expired" ? 0.65 : 1 }}>
                  <td className="px-4 py-4 align-top">
                    <Link href={`/requests/${r.id}`} className="font-bold hover:underline" dir="ltr">{r.reference}</Link>
                    {r.isNew && <span className="ms-2 px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" }}>{t("new")}</span>}
                    {r.unread > 0 && <span className="ms-2 px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#c2410c", color: "white" }} data-unread={r.unread}>{t("unreadMessages", { count: r.unread })}</span>}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Link href={`/requests/${r.id}`} className="font-bold hover:underline">{r.title}</Link>
                    {r.specs && <span className="mt-1 block text-sm" style={{ color: "var(--muted)" }}>{r.specs}</span>}
                  </td>
                  <td className="px-4 py-4 text-end align-top font-bold whitespace-nowrap">{r.volume || "-"}</td>
                  <td className="px-4 py-4 align-top">{r.destination || "-"}</td>
                  <td className="px-4 py-4 align-top">{r.incoterm && <span className="px-2 py-1 text-xs font-bold" style={{ border: `1px solid ${HAIR}` }}>{r.incoterm}</span>}</td>
                  <td className="px-4 py-4 align-top text-sm">{due(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col md:hidden">
            {shown.map((r) => (
              <li key={r.id} style={{ borderTop: `1px solid ${HAIR}` }}>
                <Link href={`/requests/${r.id}`} className="flex flex-col gap-1 p-4">
                  <span className="text-xs font-bold" dir="ltr" style={{ color: "var(--muted)", textAlign: "start" }}>{r.reference}{r.isNew ? ` · ${t("new")}` : ""}{r.unread > 0 ? ` · ${t("unreadMessages", { count: r.unread })}` : ""}</span>
                  <span className="font-bold">{r.title}</span>
                  <span className="text-sm"><strong>{r.volume}</strong>{r.destination ? ` · ${r.destination}` : ""}{r.incoterm ? ` · ${r.incoterm}` : ""}</span>
                  <span className="text-sm">{due(r)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
