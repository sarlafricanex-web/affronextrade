// Mise en page des emails de notification : fonction pure (aucun acces reseau ni base), partagee
// par le module d'envoi et les tests. HTML simple en tableaux (compatible avec les messageries),
// couleurs de la charte, sens de lecture de droite a gauche en arabe, et version texte brut.

export type EmailContent = {
  locale: "fr" | "en" | "ar";
  preheader: string; // apercu affiche par la messagerie avant l'ouverture
  title: string;
  greeting: string;
  paragraphs: string[];
  rows?: { label: string; value: string }[];
  cta: { label: string; url: string };
  footer: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const rtl = c.locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const rows = (c.rows ?? [])
    .map((r) => `<tr><td style="padding:6px 0;color:#5c5347;font-size:13px;width:40%;text-align:${align};">${esc(r.label)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:${align};">${esc(r.value)}</td></tr>`)
    .join("");
  const html = `<!doctype html>
<html lang="${c.locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.title)}</title></head>
<body style="margin:0;padding:0;background:#ece3d4;font-family:Arial,Helvetica,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece3d4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d8cebb;" dir="${dir}">
<tr><td style="padding:20px 28px;border-bottom:3px solid #10b981;text-align:${align};">
<span style="font-size:18px;font-weight:800;letter-spacing:1px;color:#059669;">AFRICA</span><span style="font-size:18px;font-weight:800;letter-spacing:1px;color:#f97316;"> NEX</span>
</td></tr>
<tr><td style="padding:28px;text-align:${align};">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">${esc(c.title)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">${esc(c.greeting)}</p>
${c.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">${esc(p)}</p>`).join("\n")}
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-top:1px solid #d8cebb;border-bottom:1px solid #d8cebb;">${rows}</table>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr><td style="background:#0f172a;">
<a href="${esc(c.cta.url)}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(c.cta.label)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 28px;background:#f5efe6;border-top:1px solid #d8cebb;font-size:12px;line-height:1.5;color:#5c5347;text-align:${align};">${esc(c.footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    c.title,
    "",
    c.greeting,
    "",
    ...c.paragraphs.flatMap((p) => [p, ""]),
    ...(c.rows ?? []).map((r) => `${r.label} : ${r.value}`),
    ...(c.rows?.length ? [""] : []),
    `${c.cta.label} : ${c.cta.url}`,
    "",
    "--",
    c.footer,
  ].join("\n");
  return { html, text };
}
