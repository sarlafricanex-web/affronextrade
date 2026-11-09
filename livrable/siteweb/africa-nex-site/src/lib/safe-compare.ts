import "server-only";
import { timingSafeEqual } from "crypto";

// Comparaison en temps constant : la duree ne revele pas ou le secret differe.
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
