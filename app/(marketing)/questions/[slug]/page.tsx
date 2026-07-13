import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES, type SeoPage } from "../../../../data/seo-pages";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";
import { QuestionSetPage } from "@/marketing-v2/QuestionPages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* /questions/[slug] — static SEO pages for long-tail interview queries.
 *
 * Slug encoding mirrors the existing /companies/[slug] pattern so the two
 * routes can cross-link freely. The same slugs from data/seo-pages.ts power
 * both routes; /questions/<slug> is the canonical URL going forward (shorter,
 * more topically specific), while /companies/<slug> remains live.
 *
 * Strategy: own the "practice" intent layer that AmbitionBox / Glassdoor
 * underserve — those sites list questions; we let candidates practice
 * answering them with an AI that grades them in real time.
 */

export const revalidate = 86400; /* 24 h */

/* ─── Human-readable labels ─────────────────────────────────────────────── */

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural",
  technical: "Technical",
  "system-design": "System Design",
  "case-study": "Case Study",
  "campus-placement": "Campus Placement",
  hr: "HR Round",
  panel: "Panel Interview",
  "salary-negotiation": "Salary Negotiation",
  leadership: "Leadership",
  general: "General",
  management: "Management",
  "government-psu": "Government / PSU",
  strategic: "Strategic",
};

const COMPANY_LABEL: Record<string, string> = {
  google: "Google",
  amazon: "Amazon",
  microsoft: "Microsoft",
  meta: "Meta",
  apple: "Apple",
  netflix: "Netflix",
  flipkart: "Flipkart",
  razorpay: "Razorpay",
  swiggy: "Swiggy",
  zomato: "Zomato",
  phonepe: "PhonePe",
  paytm: "Paytm",
  cred: "CRED",
  zerodha: "Zerodha",
  meesho: "Meesho",
  freshworks: "Freshworks",
  zoho: "Zoho",
  tcs: "TCS",
  infosys: "Infosys",
  wipro: "Wipro",
  cognizant: "Cognizant",
  accenture: "Accenture",
  uber: "Uber",
  atlassian: "Atlassian",
  stripe: "Stripe",
  linkedin: "LinkedIn",
  adobe: "Adobe",
  mckinsey: "McKinsey",
  bcg: "BCG",
  bain: "Bain",
  deloitte: "Deloitte",
  goldman: "Goldman Sachs",
  jpmc: "JPMorgan Chase",
  "morgan-stanley": "Morgan Stanley",
  "jane-street": "Jane Street",
  "de-shaw": "DE Shaw",
  citadel: "Citadel",
  openai: "OpenAI",
  anthropic: "Anthropic",
  sarvam: "Sarvam AI",
  salesforce: "Salesforce",
  cisco: "Cisco",
  oracle: "Oracle",
  nvidia: "NVIDIA",
  hdfc: "HDFC",
  icici: "ICICI",
  hul: "HUL",
  "p&g": "P&G",
  itc: "ITC",
  upsc: "UPSC",
  ssc: "SSC",
  ibps: "IBPS",
  rbi: "RBI",
  isro: "ISRO",
  drdo: "DRDO",
  ssb: "SSB",
};

/* ─── Question fetching with tier fallback ──────────────────────────────── */

function questionsForPage(p: SeoPage): BankEntry[] {
  /* Tier 1: exact (company × focus × roleFamily) match. */
  const exact = QUESTION_BANK.filter(
    (q) =>
      q.company === p.company &&
      q.focus === p.focus &&
      (!p.roleFamily || q.roleFamily === p.roleFamily),
  );
  if (exact.length >= 4) return exact.slice(0, 12);

  /* Tier 2: drop roleFamily constraint, keep company + focus. */
  const noRole = QUESTION_BANK.filter(
    (q) => q.company === p.company && q.focus === p.focus,
  );
  if (noRole.length >= 4) return noRole.slice(0, 12);

  /* Tier 3: focus-only — same focus area across all companies. */
  return QUESTION_BANK.filter((q) => q.focus === p.focus).slice(0, 12);
}

/* ─── generateStaticParams — pre-renders every slug at build time ────────── */

export async function generateStaticParams() {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

/* ─── generateMetadata ───────────────────────────────────────────────────── */

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return { title: "Not Found" };

  const title = `${page.searchPhrase} — Practice Free | HireStepX`;
  const description = `${page.intro.split(".")[0]}. Practice with AI voice feedback. 2 free sessions, no credit card.`;

  return {
    title,
    description,
    keywords: page.metaKeywords.join(", "),
    alternates: { canonical: `/questions/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `https://hirestepx.com/questions/${slug}`,
      siteName: "HireStepX",
      locale: "en_IN",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function QuestionsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { headers } = await import("next/headers");
  const nonce = (await headers()).get("x-nonce") ?? "";
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) notFound();

  const questions = questionsForPage(page);
  const companyLabel = COMPANY_LABEL[page.company] ?? page.company;
  const focusLabel = FOCUS_LABEL[page.focus] ?? page.focus;

  /* FAQPage schema — expandable accordion in Google mobile SERP. */
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.text,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${page.framework.name}: ${page.framework.summary} Practice this question with HireStepX to get AI-graded feedback on your answer structure, delivery, and specificity.`,
      },
    })),
  };

  /* Article schema — signals editorial content, not a thin landing page. */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.searchPhrase,
    description: page.intro,
    author: { "@type": "Organization", name: "HireStepX" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-06-21",
    dateModified: "2026-06-21",
    inLanguage: "en-IN",
  };

  /* Related pages: same company OR same focus area, up to 4. */
  const relatedPages = SEO_PAGES.filter(
    (p: SeoPage) =>
      p.slug !== slug &&
      (p.company === page.company || p.focus === page.focus),
  )
    .slice(0, 4)
    .map((p: SeoPage) => ({ slug: p.slug, searchPhrase: p.searchPhrase }));

  return (
    <>
      {/* Structured data */}
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(faqSchema)}
      />
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(articleSchema)}
      />
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([
            { name: "Questions", path: "/questions" },
            { name: page.searchPhrase, path: `/questions/${slug}` },
          ]),
        )}
      />

      {/* Page body */}
      <QuestionSetPage
        slug={slug}
        page={page}
        questions={questions}
        companyLabel={companyLabel}
        focusLabel={focusLabel}
        relatedPages={relatedPages}
      />
    </>
  );
}
