"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Relance le rendu serveur de la page sans recharger le navigateur.
export function RefreshButton() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-busy={pending}
      className="px-5 py-3 text-sm font-bold uppercase disabled:opacity-50"
      style={{ background: "white", border: "1px solid var(--field-b)", letterSpacing: "0.08em" }}
    >
      {t("refresh")}
    </button>
  );
}
