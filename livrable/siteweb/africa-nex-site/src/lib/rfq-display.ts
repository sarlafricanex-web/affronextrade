import "server-only";
import { countryName } from "@/lib/countries";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type RfqLike = {
  quantity_mode: string;
  quantity: number | string | null;
  unit: string | null;
  container_size: string | null;
  container_reefer: boolean;
  container_count: number | null;
  destination_country: string | null;
  destination_port: string | null;
};

// Libelles d'affichage communs a la liste et au detail d'une demande.
export function volumeLabel(r: RfqLike, t: Translate, o: Translate, locale: string) {
  if (r.quantity_mode === "containers" && r.container_count && r.container_size) {
    return t(r.container_reefer ? "volumeContainersReefer" : "volumeContainers", { count: r.container_count, size: r.container_size });
  }
  const qty = r.quantity === null ? "" : Number(r.quantity).toLocaleString(locale);
  return `${qty} ${r.unit ? o(`unitShort_${r.unit}`) : ""}`.trim();
}

export function destinationLabel(r: RfqLike, locale: string) {
  const country = r.destination_country ? countryName(r.destination_country, locale) : "";
  return [r.destination_port, country].filter(Boolean).join(", ");
}
