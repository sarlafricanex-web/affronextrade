"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitReview, type ReviewState } from "@/app/[locale]/producers/actions";

const HAIR = "#d8cebb";
const caps = "mb-2 block text-[11px] font-bold uppercase";
const capsStyle = { letterSpacing: "0.08em", color: "var(--muted)" } as const;

// Formulaire d'avis d'apres la maquette Stitch 10. L'identite affichee est celle que la base
// publiera (prenom + initiale, pays) : jamais l'entreprise acheteuse.
export function ReviewForm({ slug, publishedAs }: { slug: string; publishedAs: string }) {
  const t = useTranslations("producers");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const v = state.values ?? { rating: "", comment: "" };
  const [rating, setRating] = useState<{ value: number; attempt?: number } | null>(null);
  const [length, setLength] = useState<{ value: number; attempt?: number } | null>(null);
  const current = rating && rating.attempt === state.attempt ? rating.value : Number(v.rating) || 0;
  const chars = length && length.attempt === state.attempt ? length.value : v.comment.length;

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      {state.error && <p role="alert" className="text-sm font-semibold" style={{ color: "#dc2626" }}>{t(state.error)}</p>}

      <fieldset>
        <legend className={caps} style={capsStyle}>{t("reviewRating")}</legend>
        <div className="flex flex-wrap items-center gap-4 p-4" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>
          {/* Etoiles : boutons radio, utilisables au clavier ; de droite a gauche pour colorer les precedentes au survol. */}
          <div className="review-stars flex w-fit flex-row-reverse justify-end gap-1" dir="ltr">
            {[5, 4, 3, 2, 1].map((n) => (
              <label key={n} className="cursor-pointer" title={t("reviewStars", { count: n })}>
                <input type="radio" name="rating" value={n} required defaultChecked={v.rating === String(n)} onChange={() => setRating({ value: n, attempt: state.attempt })} className="peer sr-only" />
                <span className="sr-only">{t("reviewStars", { count: n })}</span>
                <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" className="star" stroke="#f97316" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </label>
            ))}
          </div>
          <span className="px-3 py-1.5 text-sm font-semibold" aria-live="polite" style={{ background: "white", border: `1px solid ${HAIR}` }}>
            {current ? `${current} / 5 — ${t(`ratingLabel${current}`)}` : t("ratingChoose")}
          </span>
        </div>
      </fieldset>

      <div>
        <span className={caps} style={capsStyle}>{t("reviewPublishedAs")}</span>
        <p className="px-4 py-3 text-sm font-semibold" style={{ background: "#e3d9c8", border: `1px solid ${HAIR}` }}>{publishedAs}</p>
      </div>

      <label className="block">
        <span className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase" style={capsStyle}>{t("reviewComment")}</span>
          <span className="text-[11px] font-semibold" style={{ color: chars > 1000 ? "#dc2626" : "var(--muted)", fontFeatureSettings: '"tnum" 1' }}>{t("charCount", { count: chars })}</span>
        </span>
        <textarea
          name="comment"
          required
          minLength={20}
          maxLength={1000}
          rows={5}
          defaultValue={v.comment}
          placeholder={t("reviewCommentPlaceholder")}
          onChange={(e) => setLength({ value: e.target.value.length, attempt: state.attempt })}
          className="w-full resize-y px-4 py-3 text-sm"
          style={{ background: "white", border: `1px solid ${HAIR}`, outline: "none" }}
        />
      </label>

      <p className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        {t("reviewPublishedAfterCheck")}
      </p>

      <div className="flex justify-end pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
        <button type="submit" disabled={pending} className="flex items-center gap-2 px-8 py-3 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "#047857", color: "white", letterSpacing: "0.08em" }}>
          {pending ? t("reviewSending") : t("submitReview")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </form>
  );
}
