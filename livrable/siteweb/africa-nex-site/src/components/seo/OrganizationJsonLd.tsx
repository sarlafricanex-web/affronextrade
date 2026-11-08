export function OrganizationJsonLd({ locale }: { locale: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AFRICA NEX",
    legalName: "SARL AFRICA NEX",
    url: "https://affronextrade.vercel.app",
    description:
      locale === "ar"
        ? "منصة B2B تربط المنتجين الجزائريين بالأسواق الدولية"
        : locale === "en"
          ? "B2B marketplace connecting Algerian producers to international markets"
          : "Marketplace B2B connectant les producteurs algeriens aux marches internationaux",
    foundingDate: "2024",
    founder: {
      "@type": "Person",
      name: "Adlene",
      jobTitle: "CEO",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Cite 50 LSP + 18, Bloc 1, n52",
      addressLocality: "Setif",
      addressCountry: "DZ",
    },
    telephone: "+213770960270",
    email: "contact@africanex.com",
    areaServed: [
      { "@type": "Country", name: "Algeria" },
      { "@type": "Country", name: "Nigeria" },
      { "@type": "Country", name: "Ivory Coast" },
      { "@type": "Country", name: "Senegal" },
      { "@type": "Country", name: "Ethiopia" },
      { "@type": "Country", name: "Ghana" },
      { "@type": "Country", name: "Cameroon" },
      { "@type": "Country", name: "Kenya" },
      { "@type": "Country", name: "Central African Republic" },
    ],
    knowsAbout: [
      "B2B Trade",
      "Export",
      "Algerian Products",
      "African Markets",
      "Agri-food",
      "Automotive Parts",
      "Ceramics",
    ],
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
