import { getFormatter, getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { deleteDocument } from "@/app/[locale]/(app)/company/document-actions";
import { MAX_DOCUMENTS } from "@/lib/documents";
import { DocumentUpload } from "./DocumentUpload";

const STATUS_COLOR = { pending: "#f97316", accepted: "var(--accent)", rejected: "#dc2626" } as const;

// Onglet "Documents" de Mon entreprise : liste, statut de verification, depot.
export async function DocumentsPanel({ client, companyId, locale, notice }: { client: SupabaseClient<Database>; companyId: string; locale: string; notice?: string }) {
  const [t, format, { data: docs, error }] = await Promise.all([
    getTranslations({ locale, namespace: "documents" }),
    getFormatter({ locale }),
    client.from("company_documents").select("id, kind, title, is_public, review_status, expires_on, file_type, created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-8">
      {notice && <p role="status" className="p-4 font-semibold" style={{ background: "var(--ground)", borderInlineStart: "4px solid var(--accent)" }}>{t(notice === "deleted" ? "deletedNotice" : "addedNotice")}</p>}
      <div>
        <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("listTitle")}</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)", maxWidth: "65ch" }}>{t("intro")}</p>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col" style={{ borderTop: "1px solid var(--field-b)" }}>
          {docs.map((d) => {
            const expired = d.expires_on && d.expires_on < today;
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-4" style={{ borderBottom: "1px solid var(--field-b)" }}>
                <div className="min-w-0">
                  <p className="font-semibold">{d.title || t(`kind_${d.kind}`)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs" style={{ color: "var(--muted)" }}>
                    <span>{t(`kind_${d.kind}`)}</span>
                    <span>{d.is_public ? t("publicShort") : t("privateShort")}</span>
                    {d.expires_on && (
                      <span style={{ color: expired ? "#dc2626" : undefined }}>
                        {t(expired ? "expired" : "expires", { date: format.dateTime(new Date(`${d.expires_on}T12:00:00`), { dateStyle: "medium" }) })}
                      </span>
                    )}
                    <span className="font-bold uppercase" style={{ color: STATUS_COLOR[d.review_status as keyof typeof STATUS_COLOR], letterSpacing: "0.06em" }}>{t(`status_${d.review_status}`)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="text-xs font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>{t("open")}</a>
                  <form action={deleteDocument}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="text-xs font-bold uppercase" style={{ color: "#dc2626", letterSpacing: "0.08em" }}>{t("delete")}</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {docs.length < MAX_DOCUMENTS ? (
        <div className="p-5" style={{ border: "1px solid var(--field-b)" }}>
          <h3 className="mb-4 font-bold">{t("addTitle")}</h3>
          <DocumentUpload />
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("docErrorCount")}</p>
      )}
    </div>
  );
}
