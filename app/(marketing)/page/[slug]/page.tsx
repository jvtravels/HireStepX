import { permanentRedirect } from "next/navigation";

/**
 * Legacy `/page/<slug>` URLs are permanently retired in favour of the
 * canonical new-design marketing routes. Each known slug maps to its
 * replacement; anything unrecognised falls back to the homepage. This
 * keeps old inbound links (and the dead PlaceholderPage footer links
 * that used to live here) from 404ing while removing the off-brand
 * dark-design surface entirely.
 */
const SLUG_REDIRECTS: Record<string, string> = {
  about: "/about",
  contact: "/contact",
  help: "/contact",
  careers: "/about",
  privacy: "/privacy",
  terms: "/terms",
  refund: "/refund",
  pricing: "/pricing",
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(SLUG_REDIRECTS[slug.toLowerCase()] ?? "/");
}
