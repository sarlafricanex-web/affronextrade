import { getFormatter, getTranslations } from "next-intl/server";
import type { ThreadMessage } from "@/lib/data/messages";

const HAIR = "#d8cebb";

// Lot 5f : un fil de messages (maquettes 14 et 16). Les messages de l'interlocuteur a gauche,
// les siens a droite. "otherName" : nom affiche pour l'autre partie (AFRICA NEX pour l'acheteur
// et le producteur ; l'acheteur ou le producteur pour la console).
export async function MessageThread({
  messages,
  mine,
  otherName,
  otherInitials,
  locale,
  emptyText,
}: {
  messages: ThreadMessage[];
  mine: "buyer" | "producer" | "admin";
  otherName: string;
  otherInitials: string;
  locale: string;
  emptyText: string;
}) {
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "thread" }), getFormatter({ locale })]);
  if (!messages.length) return <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>{emptyText}</p>;
  return (
    <ol className="flex flex-col gap-4 px-5 py-5" style={{ maxHeight: 560, overflowY: "auto" }}>
      {messages.map((m) => {
        const own = m.sender_role === mine;
        return (
          <li key={m.id} className={`flex items-start gap-3 ${own ? "flex-row-reverse" : ""}`} data-message={m.sender_role}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center text-xs font-bold" style={own ? { background: "#f5efe6", border: `1px solid ${HAIR}` } : { background: "var(--ink)", color: "white" }}>
              {own ? t("youInitials") : otherInitials}
            </span>
            <div className="min-w-0 p-4" style={{ maxWidth: "min(560px, 85%)", background: own ? "#fff7ed" : "white", border: `1px solid ${own ? "#fdba74" : HAIR}` }}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
                <strong>{own ? t("you") : otherName}</strong>
                <span style={{ color: "var(--muted)" }}>{format.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short" })}</span>
              </p>
              <p className="mt-2 whitespace-pre-line text-sm" style={{ overflowWrap: "anywhere" }}>{m.body}</p>
              {own && <p className="mt-2 text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{m.read_at ? t("read") : t("unread")}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
