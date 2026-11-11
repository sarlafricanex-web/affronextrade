import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ProducerDirectory } from "@/components/producers/ProducerDirectory";
import { getProducerCards, type ProducerCard } from "@/lib/data/directory";
import { makePageMetadata } from "@/lib/seo";

// Si la base ne repond pas, la page reste en ligne avec un message plutot qu'une erreur.
async function loadProducers(): Promise<{ producers: ProducerCard[]; unavailable: boolean }> {
  try {
    return { producers: await getProducerCards(), unavailable: false };
  } catch (e) {
    console.error("Directory load failed:", e);
    return { producers: [], unavailable: true };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return makePageMetadata({ locale, titleKey: "producersTitle", descriptionKey: "producersDescription", path: "/producers" });
}

// Annuaire des producteurs, d'apres la maquette Stitch 08.
export default async function ProducersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { producers, unavailable } = await loadProducers();

  return (
    <div style={{ paddingTop: "3.5rem", background: "#fff8f3" }}>
      <ProducerDirectory producers={producers} unavailable={unavailable} />
    </div>
  );
}
