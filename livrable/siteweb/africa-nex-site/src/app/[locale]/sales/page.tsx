import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "sales");
}

export default async function SalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument locale={locale} docKey="sales" />;
}
