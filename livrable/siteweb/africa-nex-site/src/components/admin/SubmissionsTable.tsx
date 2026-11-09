"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type SubmissionRow = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  message: string | null;
  shortDate: string;
  longDate: string;
};

const digits = (value: string | null) => (value ?? "").replace(/\D/g, "");

export function SubmissionsTable({ submissions }: { submissions: SubmissionRow[] }) {
  const t = useTranslations("admin");
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<SubmissionRow | null>(null);

  function open(submission: SubmissionRow) {
    setSelected(submission);
    dialog.current?.showModal();
  }

  const whatsapp = digits(selected?.whatsapp ?? null);

  return (
    <>
      <div className="overflow-x-auto" style={{ background: "white", border: "1px solid var(--field-b)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--field-b)" }}>
              <th scope="col" className="text-start py-3 px-4 font-semibold">{t("colDate")}</th>
              <th scope="col" className="text-start py-3 px-4 font-semibold">{t("colName")}</th>
              <th scope="col" className="text-start py-3 px-4 font-semibold">{t("colEmail")}</th>
              <th scope="col" className="text-start py-3 px-4 font-semibold hidden md:table-cell">{t("colCompany")}</th>
              <th scope="col" className="text-start py-3 px-4 font-semibold hidden lg:table-cell">{t("colCountry")}</th>
              <th scope="col" className="text-start py-3 px-4 font-semibold hidden lg:table-cell">{t("colPhone")}</th>
              <th scope="col" className="py-3 px-4"><span className="sr-only">{t("view")}</span></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="cursor-pointer" style={{ borderBottom: "1px solid var(--field-b)" }} onClick={() => open(s)}>
                <td className="py-3 px-4 whitespace-nowrap" style={{ color: "var(--muted)" }}>{s.shortDate}</td>
                <td className="py-3 px-4 font-semibold">{s.name}</td>
                <td className="py-3 px-4">
                  <a href={`mailto:${s.email}`} dir="ltr" className="underline" onClick={(e) => e.stopPropagation()}>{s.email}</a>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">{s.company || "-"}</td>
                <td className="py-3 px-4 hidden lg:table-cell">{s.country || "-"}</td>
                <td className="py-3 px-4 hidden lg:table-cell whitespace-nowrap"><span dir="ltr">{s.phone || "-"}</span></td>
                <td className="py-3 px-4 text-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open(s);
                    }}
                    className="text-xs font-bold uppercase"
                    style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
                  >
                    {t("view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fenetre native : focus piege, touche Echap et fond assombri sans code supplementaire. */}
      <dialog
        ref={dialog}
        aria-labelledby="submission-title"
        onClose={() => setSelected(null)}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto p-0 backdrop:bg-black/50"
        style={{ width: "min(36rem, calc(100% - 2rem))", background: "var(--ground)", color: "var(--ink)", border: "none" }}
      >
        {selected && (
          <div>
            <div className="flex items-start justify-between gap-4 px-6 py-4" style={{ borderBottom: "1px solid var(--field-b)" }}>
              <div style={{ minWidth: 0 }}>
                <h2 id="submission-title" className="font-extrabold text-lg">{selected.name}</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{t("receivedOn", { date: selected.longDate })}</p>
              </div>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label={t("close")}
                className="text-2xl leading-none"
                style={{ color: "var(--muted)" }}
              >
                &times;
              </button>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4 px-6 py-5 text-sm">
              <Detail label={t("colEmail")}>
                <a href={`mailto:${selected.email}`} dir="ltr" className="underline break-all">{selected.email}</a>
              </Detail>
              {selected.company && <Detail label={t("colCompany")}>{selected.company}</Detail>}
              {selected.country && <Detail label={t("colCountry")}>{selected.country}</Detail>}
              {selected.phone && <Detail label={t("colPhone")}><span dir="ltr">{selected.phone}</span></Detail>}
              {selected.whatsapp && (
                <Detail label={t("colWhatsapp")}>
                  {whatsapp ? (
                    <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="underline">{selected.whatsapp}</a>
                  ) : (
                    selected.whatsapp
                  )}
                </Detail>
              )}
            </dl>

            {selected.message && (
              <div className="px-6 pb-5 text-sm">
                <p className="font-semibold" style={{ color: "var(--muted)" }}>{t("colMessage")}</p>
                <p className="mt-2 whitespace-pre-wrap break-words px-3 py-2" style={{ background: "var(--field-a)" }}>{selected.message}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--field-b)" }}>
              <a
                href={`mailto:${selected.email}`}
                className="px-4 py-2 text-xs font-bold uppercase"
                style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
              >
                {t("replyEmail")}
              </a>
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold uppercase"
                  style={{ background: "#25D366", color: "white", letterSpacing: "0.08em" }}
                >
                  {t("replyWhatsapp")}
                </a>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt className="font-semibold" style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
