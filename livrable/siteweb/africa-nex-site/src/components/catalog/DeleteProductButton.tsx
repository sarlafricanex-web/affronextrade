"use client";

import { useLocale, useTranslations } from "next-intl";
import { deleteProduct } from "@/app/[locale]/(app)/catalog/actions";

// Suppression avec confirmation du navigateur : l'action est irreversible (photos comprises).
// compact : icone corbeille (tableau), sinon bouton texte.
export function DeleteProductButton({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const c = useTranslations("catalog");
  const locale = useLocale();
  return (
    <form
      action={deleteProduct}
      onSubmit={(e) => {
        if (!window.confirm(c("confirmDelete", { name }))) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      {compact ? (
        <button type="submit" title={c("delete")} aria-label={`${c("delete")} ${name}`} className="flex h-8 w-8 items-center justify-center" style={{ border: "1px solid #fecaca", color: "#dc2626", background: "white" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>
        </button>
      ) : (
        <button type="submit" className="text-xs font-bold uppercase" style={{ color: "#dc2626", letterSpacing: "0.08em" }}>
          {c("delete")}
        </button>
      )}
    </form>
  );
}
