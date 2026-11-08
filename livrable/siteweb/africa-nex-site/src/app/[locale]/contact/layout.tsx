import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return makePageMetadata({ locale, titleKey: "contactTitle", descriptionKey: "contactDescription", path: "/contact" });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
