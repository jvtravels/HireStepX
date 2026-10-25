import type { Metadata } from "next";

const SITE = "https://hirestepx.com";
const IMAGE = `${SITE}/opengraph-image`;

export function pageMeta(o: { title: string; description: string; path: string; ogTitle?: string; ogDescription?: string }): Metadata {
  const ogTitle = o.ogTitle ?? o.title;
  const ogDescription = o.ogDescription ?? o.description;
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: {
      type: "website",
      url: `${SITE}${o.path}`,
      title: ogTitle,
      description: ogDescription,
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: IMAGE, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description: ogDescription, images: [IMAGE] },
  };
}
