// Prepare un fichier choisi dans un champ <input type="file"> AVANT l'envoi du formulaire :
// une photo de telephone (souvent 3 a 8 Mo) est reduite en JPEG d'environ 2400 px de cote,
// largement lisible pour un document scanne et bien sous la limite de 4 Mo des envois Vercel.
// Le fichier du champ est remplace par la version reduite ; un PDF est laisse tel quel.

const MAX_SIDE = 2400;
const QUALITY = 0.85;
const COMPRESS_ABOVE = 1.5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PrepareResult = { ok: true; file: File | null } | { ok: false; reason: "tooBig" | "type" };

// Passes successives (qualite puis taille) jusqu'a passer sous la cible : une photo tres detaillee
// peut rester lourde apres une seule passe.
const PASSES: [number, number][] = [[MAX_SIDE, QUALITY], [MAX_SIDE, 0.7], [1800, 0.7], [1400, 0.6]];

async function compress(file: File, target: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let best: Blob | null = null;
  try {
    for (const [side, quality] of PASSES) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff"; // fond blanc : un PNG transparent ne devient pas noir en JPEG
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && (!best || blob.size < best.size)) best = blob;
      if (best && best.size <= target) break;
    }
  } finally {
    bitmap.close();
  }
  if (!best || best.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([best], name, { type: "image/jpeg", lastModified: Date.now() });
}

export async function prepareUpload(
  input: HTMLInputElement,
  { maxBytes, allowPdf = false }: { maxBytes: number; allowPdf?: boolean },
): Promise<PrepareResult> {
  const original = input.files?.[0];
  if (!original) return { ok: true, file: null };
  const isPdf = original.type === "application/pdf" || /\.pdf$/i.test(original.name);
  if (isPdf && !allowPdf) return { ok: false, reason: "type" };
  if (!isPdf && !IMAGE_TYPES.includes(original.type)) return { ok: false, reason: "type" };

  let file = original;
  if (!isPdf && original.size > COMPRESS_ABOVE) {
    try {
      file = await compress(original, Math.min(maxBytes, 2.5 * 1024 * 1024));
    } catch {
      file = original; // navigateur trop ancien : on garde l'original, le serveur tranchera
    }
  }
  if (file.size > maxBytes) {
    input.value = "";
    return { ok: false, reason: "tooBig" };
  }
  if (file !== original) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }
  return { ok: true, file };
}
