"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type RfqRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
  stage: number; // 0 (annulee) a 5
  volume: string;
  incoterm: string | null;
  destination: string;
  date: string;
  offers: number;
  unread: number; // messages d'AFRICA NEX non lus (lot 5f)
};

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const GROUPS = { all: null, analysis: ["submitted", "qualified", "dispatched"], offers: ["offered"], closed: ["accepted", "closed", "cancelled"] } as const;
type Group = keyof typeof GROUPS;

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = status === "offered" ? { background: "#fff7ed", border: "1px solid #f97316", color: "#9a3412" }
    : status === "accepted" ? { background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" }
    : status === "cancelled" ? { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" }
    : { background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" };
  return <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, ...tone }}>{label}</span>;
}

function Unread({ n, label }: { n: number; label: string }) {
  return n > 0 ? <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f97316", color: "white" }} data-unread={n}>{label}</span> : null;
}

export function Progress({ stage, label }: { stage: number; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: stage === 4 ? "#c2410c" : stage === 0 ? "var(--muted)" : "#059669" }}>{label}</span>
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="h-1.5" style={{ background: s <= stage ? (s === 4 && stage === 4 ? "#f97316" : "#10b981") : "#e5d8c8" }} />
        ))}
      </div>
    </div>
  );
}

export function RfqList({ rows }: { rows: RfqRow[] }) {
  const t = useTranslations("rfq");
  const [group, setGroup] = useState<Group>("all");
  const [query, setQuery] = useState("");
  const counts = Object.fromEntries((Object.keys(GROUPS) as Group[]).map((g) => [g, GROUPS[g] ? rows.filter((r) => (GROUPS[g] as readonly string[]).includes(r.status)).length : rows.length]));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!GROUPS[group] || (GROUPS[group] as readonly string[]).includes(r.status)) && (!q || `${r.reference} ${r.title} ${r.destination}`.toLowerCase().includes(q)));
  }, [rows, group, query]);

  const action = (r: RfqRow) =>
    r.status === "offered" ? (
      <Link href={`/rfq/${r.id}`} className="block px-4 py-2.5 text-center text-xs font-bold uppercase" style={{ ...caps, background: "#f97316", color: "white" }}>{t("actionCompare")}</Link>
    ) : (
      <Link href={`/rfq/${r.id}`} className="block px-4 py-2.5 text-center text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", color: "var(--ink)" }}>{t("actionView")}</Link>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="w-full px-4 py-2.5 text-sm md:max-w-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }} />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(GROUPS) as Group[]).map((g) => (
            <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className="px-3 py-2 text-[11px] font-bold uppercase" style={{ ...caps, background: group === g ? "var(--ink)" : "transparent", color: group === g ? "white" : g === "offers" ? "#c2410c" : "var(--muted)" }}>
              {t(`filter_${g}`)} ({counts[g]})
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="p-8 text-center" style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{rows.length ? t("noMatch") : t("empty")}</p>
      ) : (
        <>
          <table className="hidden w-full md:table" style={{ background: "white", border: `1px solid ${HAIR}`, borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-start text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", color: "var(--muted)" }}>
                <th className="px-4 py-3 text-start">{t("colRef")}</th>
                <th className="px-4 py-3 text-start">{t("colVolume")}</th>
                <th className="px-4 py-3 text-start">{t("colDate")}</th>
                <th className="px-4 py-3 text-start" style={{ minWidth: 180 }}>{t("colProgress")}</th>
                <th className="px-4 py-3 text-start">{t("colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${HAIR}` }}>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold" dir="ltr" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>{r.reference}</span>
                      <StatusBadge status={r.status} label={t(`status_${r.status}`)} />
                      <Unread n={r.unread} label={t("unreadMessages", { count: r.unread })} />
                    </div>
                    <p className="mt-2 font-bold">{r.title}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm">
                    <span className="block font-bold">{r.volume}</span>
                    <span className="block" style={{ color: "var(--muted)" }}>{[r.destination, r.incoterm].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-4 py-4 align-top text-sm whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-4 align-top"><Progress stage={r.stage} label={t(`stage_${r.status}`, { count: r.offers })} /></td>
                  <td className="px-4 py-4 align-top" style={{ width: 170 }}>{action(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4" style={{ background: "white", border: `1px solid ${HAIR}` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 text-[11px] font-bold" dir="ltr" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>{r.reference}</span>
                  <StatusBadge status={r.status} label={t(`status_${r.status}`)} />
                  <Unread n={r.unread} label={t("unreadMessages", { count: r.unread })} />
                </div>
                <p className="font-bold">{r.title}</p>
                <p className="text-sm"><strong>{r.volume}</strong> <span style={{ color: "var(--muted)" }}>· {[r.destination, r.incoterm].filter(Boolean).join(" · ")} · {r.date}</span></p>
                <Progress stage={r.stage} label={t(`stage_${r.status}`, { count: r.offers })} />
                {action(r)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
