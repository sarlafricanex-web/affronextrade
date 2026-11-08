import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://affronextrade.vercel.app";

export async function makePageMetadata({
  locale,
  titleKey,
  descriptionKey,
  path,
}: {
  locale: string;
  titleKey: string;
  descriptionKey: string;
  path: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = `${BASE_URL}/${loc}${path}`;
  }

  return {
    title: t(titleKey),
    description: t(descriptionKey),
    alternates: {
      canonical: `${BASE_URL}/${locale}${path}`,
      languages,
    },
    openGraph: {
      title: t(titleKey),
      description: t(descriptionKey),
      url: `${BASE_URL}/${locale}${path}`,
      locale: locale === "ar" ? "ar_DZ" : locale === "en" ? "en_US" : "fr_DZ",
    },
  };
}
