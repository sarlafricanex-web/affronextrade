"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitReview, type ReviewState } from "@/app/[locale]/producers/actions";

export function ReviewForm({ slug }: { slug: string }) {
  const t = useTranslations("producers");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const v = state.values ?? { rating: "", comment: "" };

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      {state.error && <p role="alert" className="text-sm font-semibold" style={{ color: "#dc2626" }}>{t(state.error)}</p>}
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("reviewRating")}</legend>
        {/* Etoiles : boutons radio, utilisables au clavier ; de droite a gauche pour colorer les precedentes au survol. */}
        <div className="review-stars flex w-fit flex-row-reverse justify-end gap-1" dir="ltr">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="cursor-pointer" title={t("reviewStars", { count: n })}>
              <input type="radio" name="rating" value={n} required defaultChecked={v.rating === String(n)} className="peer sr-only" />
              <span className="sr-only">{t("reviewStars", { count: n })}</span>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="star" stroke="#f59e0b" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("reviewComment")}</span>
        <textarea name="comment" required minLength={20} maxLength={1000} rows={4} defaultValue={v.comment} placeholder={t("reviewCommentPlaceholder")} className="w-full resize-y px-4 py-3 text-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" }} />
      </label>
      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("reviewPrivacy")}</p>
      <button type="submit" disabled={pending} className="w-fit px-6 py-3 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
        {pending ? t("reviewSending") : t("submitReview")}
      </button>
    </form>
  );
}
