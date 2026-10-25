export type Group = "Core policies";

export type DocMeta = { slug: string; title: string; blurb: string; updated: string; group: Group };

const POLICY = "18 October 2026";

export const LEGAL_META: DocMeta[] = [
  { slug: "privacy", title: "Privacy Policy", blurb: "What we collect, who we share it with, cookies, your DPDP rights and the Grievance Officer.", updated: POLICY, group: "Core policies" },
  { slug: "terms", title: "Terms of Service", blurb: "The rules for using HireStepX, payments, acceptable use, complaints and liability.", updated: POLICY, group: "Core policies" },
  { slug: "refund", title: "Refund Policy", blurb: "When credits are refunded, how to ask, and what is not refundable.", updated: POLICY, group: "Core policies" },
];

export const LEGAL_SLUGS = LEGAL_META.map((d) => d.slug);
