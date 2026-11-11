import { getTranslations } from "next-intl/server";
import { adminProducerAction } from "@/app/[locale]/(app)/admin/producers/actions";

// Boutons d'action admin sur une fiche (formulaires serveur, sans JavaScript necessaire).
export async function ProducerOps({
  id,
  locale,
  visibility,
  verified,
  claimed,
  back = "list",
}: {
  id: string;
  locale: string;
  visibility: string;
  verified: boolean;
  claimed: boolean;
  back?: "list" | "edit";
}) {
  const t = await getTranslations({ locale, namespace: "admin" });
  const ops: { op: string; label: string; tone: "accent" | "muted" | "danger"; disabled?: boolean; title?: string }[] = [];
  if (visibility !== "published") ops.push({ op: "publish", label: t("opPublish"), tone: "accent" });
  if (visibility === "published") ops.push({ op: "unpublish", label: t("opUnpublish"), tone: "muted" });
  if (visibility !== "suspended") ops.push({ op: "suspend", label: t("opSuspend"), tone: "danger" });
  ops.push(
    verified
      ? { op: "unverify", label: t("opUnverify"), tone: "muted" }
      : { op: "verify", label: t("opVerify"), tone: "accent", disabled: !claimed, title: claimed ? undefined : t("opVerifyUnclaimed") },
  );
  const color = { accent: "var(--accent)", muted: "var(--muted)", danger: "#dc2626" } as const;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {ops.map((o) => (
        <form key={o.op} action={adminProducerAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value={o.op} />
          <input type="hidden" name="back" value={back} />
          <button
            type="submit"
            disabled={o.disabled}
            title={o.title}
            className="text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: color[o.tone], letterSpacing: "0.08em" }}
          >
            {o.label}
          </button>
        </form>
      ))}
    </div>
  );
}
