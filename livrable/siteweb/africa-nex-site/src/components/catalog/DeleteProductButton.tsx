"use client";

import { useLocale, useTranslations } from "next-intl";
import { deleteProduct } from "@/app/[locale]/(app)/catalog/actions";

// Suppression avec confirmation du navigateur : l'action est irreversible (photos comprises).
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
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
      <button type="submit" className="text-xs font-bold uppercase" style={{ color: "#dc2626", letterSpacing: "0.08em" }}>
        {c("delete")}
      </button>
    </form>
  );
}
