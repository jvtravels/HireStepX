const SITE = "https://hirestepx.com";

export function JsonLd({ data }: { data: object | object[] }) {
  const list = Array.isArray(data) ? data : [data];
  return (
    <>
      {list.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />
      ))}
    </>
  );
}

export function breadcrumbs(trail: [name: string, path: string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [["Home", "/"], ...trail].map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${path}` })),
  };
}

export function faqPage(qa: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HireStepX",
  url: SITE,
  logo: `${SITE}/wordmark.png`,
  image: `${SITE}/opengraph-image`,
  description: "AI mock interview platform for Indian job seekers. Speak your answers, get a scored report and a coached model answer.",
  sameAs: ["https://www.linkedin.com/company/hirestepx"],
  contactPoint: { "@type": "ContactPoint", email: "hello@hirestepx.com", contactType: "Customer Support", availableLanguage: ["English"] },
};

export const WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "HireStepX",
  url: SITE,
  inLanguage: "en-IN",
};

export const PRICING_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "HireStepX AI Mock Interview Practice",
  description: "Spoken AI mock interviews with a scored STAR report and a coached model answer.",
  brand: { "@type": "Brand", name: "HireStepX" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: "0",
    highPrice: "39",
    offerCount: 3,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR", description: "2 sessions, no card needed", url: `${SITE}/pricing` },
      { "@type": "Offer", name: "Single session", price: "9", priceCurrency: "INR", description: "One session, credit never expires", url: `${SITE}/pricing` },
      { "@type": "Offer", name: "Sprint Pack", price: "39", priceCurrency: "INR", description: "5 sessions, valid for 30 days", url: `${SITE}/pricing` },
    ],
  },
};
