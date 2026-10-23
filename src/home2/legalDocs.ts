export type Group = "Core policies" | "Your data" | "Employers" | "Help";

export type DocMeta = { slug: string; title: string; blurb: string; updated: string; group: Group };

const POLICY = "18 October 2026";
const NEW = "23 October 2026";

export const LEGAL_META: DocMeta[] = [
  { slug: "privacy", title: "Privacy Policy", blurb: "What we collect, why, who we share it with, and your rights under the DPDP Act.", updated: POLICY, group: "Core policies" },
  { slug: "terms", title: "Terms of Service", blurb: "The rules for using HireStepX, payments, acceptable use and liability.", updated: POLICY, group: "Core policies" },
  { slug: "refund", title: "Refund Policy", blurb: "When credits are refunded, how to ask, and what is not refundable.", updated: POLICY, group: "Core policies" },
  { slug: "cookies", title: "Cookie Policy", blurb: "Which cookies we use, and how to change your choice at any time.", updated: NEW, group: "Core policies" },
];

export const LEGAL_SLUGS = LEGAL_META.map((d) => d.slug);
