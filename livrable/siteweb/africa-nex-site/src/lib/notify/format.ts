// Formats neutres pour les emails (lisibles dans les trois langues).
// 2026-11-25 -> 25/11/2026
export const frDate = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : "-");
// 1234.5 EUR -> 1 234,50 EUR (espaces fines non utilisees : certaines messageries les affichent mal)
export const money = (n: number | string | null | undefined, currency: string | null | undefined) =>
  `${Number(n ?? 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${currency ?? ""}`.trim();
