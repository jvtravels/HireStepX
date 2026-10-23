export type Group = "Core policies" | "Your data" | "Employers" | "Help";

export type DocMeta = { slug: string; title: string; blurb: string; updated: string; group: Group };

const POLICY = "18 October 2026";
const NEW = "23 October 2026";

export const LEGAL_META: DocMeta[] = [
  { slug: "privacy", title: "Privacy Policy", blurb: "What we collect, why, who we share it with, and your rights under the DPDP Act.", updated: POLICY, group: "Core policies" },
  { slug: "terms", title: "Terms of Service", blurb: "The rules for using HireStepX, payments, acceptable use and liability.", updated: POLICY, group: "Core policies" },
  { slug: "refund", title: "Refund Policy", blurb: "When credits are refunded, how to ask, and what is not refundable.", updated: POLICY, group: "Core policies" },
  { slug: "cookies", title: "Cookie Policy", blurb: "Which cookies we use, and how to change your choice at any time.", updated: NEW, group: "Core policies" },
  { slug: "retention", title: "Data retention and deletion", blurb: "How long we keep your data and what happens when you delete your account.", updated: NEW, group: "Your data" },
  { slug: "voice", title: "Voice and recording", blurb: "We do not store recordings. Who handles your voice while you answer.", updated: NEW, group: "Your data" },
  { slug: "ai-scoring", title: "AI and scoring", blurb: "What the AI does, what it receives, and what a score does and does not mean.", updated: NEW, group: "Your data" },
  { slug: "subprocessors", title: "Subprocessors", blurb: "Every provider that processes data on our behalf, and what each receives.", updated: NEW, group: "Your data" },
  { slug: "employer-terms", title: "Employer terms", blurb: "What an unlock buys, fees, GST, candidate data use and suspension.", updated: POLICY, group: "Employers" },
  { slug: "grievance", title: "Grievance Officer", blurb: "Who to write to, how fast we respond, and how to escalate.", updated: "11 October 2026", group: "Help" },
];

export const LEGAL_SLUGS = LEGAL_META.map((d) => d.slug);
