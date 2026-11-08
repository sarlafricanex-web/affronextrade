import type { MetadataRoute } from "next";

const BASE_URL = "https://affronextrade.vercel.app";
const locales = ["fr", "en", "ar"] as const;

const pages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/services", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/categories", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/producers", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/buyers", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/opportunities", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      const url = `${BASE_URL}/${locale}${page.path}`;

      const alternates: Record<string, string> = {};
      for (const alt of locales) {
        alternates[alt] = `${BASE_URL}/${alt}${page.path}`;
      }

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages: alternates },
      });
    }
  }

  return entries;
}
