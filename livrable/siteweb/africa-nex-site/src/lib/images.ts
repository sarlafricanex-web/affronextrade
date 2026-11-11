import "server-only";

export type ImageKind = "png" | "jpg" | "webp";

// Type reel d'une image d'apres ses premiers octets : le nom et le type annonces ne prouvent rien.
export function imageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export const contentTypeOf = (kind: ImageKind) => (kind === "jpg" ? "image/jpeg" : `image/${kind}`);

// Lit un fichier envoye par formulaire : null si absent, sinon l'image verifiee ou une erreur.
export async function readImage(value: FormDataEntryValue | null, maxBytes: number) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > maxBytes) return { error: "size" as const };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const kind = imageKind(bytes);
  return kind ? { bytes, kind } : { error: "type" as const };
}

// Justificatif : PDF, PNG ou JPEG (pas de WebP, refuse par le bucket des documents).
export type DocumentKind = "pdf" | "png" | "jpg";
const DOC_TYPES: Record<DocumentKind, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };
export const documentContentType = (kind: DocumentKind) => DOC_TYPES[kind];

export async function readDocument(value: FormDataEntryValue | null, maxBytes: number) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > maxBytes) return { error: "size" as const };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const isPdf = bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  const image = imageKind(bytes);
  const kind: DocumentKind | null = isPdf ? "pdf" : image === "png" || image === "jpg" ? image : null;
  return kind ? { bytes, kind } : { error: "type" as const };
}
