import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getSeoPageBySlug, getAllSeoSlugs, SEO_PAGES, SEO_PAGES_LAST_MODIFIED, type SeoPage } from "../../../../data/seo-pages";
import { getSalaryPage } from "../../../../data/salary-seo";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";
import { QuestionSetPage } from "@/marketing-v2/QuestionPages";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { COMPANY_LABEL } from "../../../../data/company-labels";
import { BLOG_META } from "../../../../src/blog-meta";

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


/* ─── Company category map for related-page ranking ────────────────────── */
const CATEGORY: Record<string, string> = (() => {
  const groups: [string, string[]][] = [
    ["service-it", ["tcs","infosys","wipro","cognizant","accenture","ltimindtree","hcl","capgemini","ibm","techmahindra","mphasis","persistent","ntt-data","globallogic","thoughtworks"]],
    ["indian-product", ["flipkart","razorpay","swiggy","zomato","phonepe","paytm","cred","zerodha","meesho","oyo","freshworks","zoho","nykaa","mamaearth","myntra","bigbasket","blinkit","makemytrip","ixigo","dream11","lenskart","boat","naukri","sharechat","truecaller","groww","dmart","wakefit","zepto","udaan"]],
    ["faang", ["google","amazon","microsoft","meta","apple","netflix","linkedin","adobe","uber","stripe","salesforce","atlassian","workday","servicenow","vmware","nvidia","openai","anthropic","perplexity","postman","chargebee","clevertap","moengage","inmobi","druva","browserstack","darwinbox"]],
    ["consulting", ["mckinsey","bcg","bain","deloitte","goldman","jpmc","ey","kpmg","pwc"]],
    ["fintech", ["bajaj-finance","fibe","kreditbee","moneyview","rupeek","fi-money","niyo","smallcase","indmoney","zeta","nium","upstox","angel-one","jupiter","navi","slice","cashfree","juspay","pine-labs","bharatpe","acko","policybazaar","icici-lombard","digit"]],
    ["banking", ["hdfc-bank","icici","hdfc","axis","kotak","sbi","barclays","hsbc","citi","deutsche-bank","bny-mellon","standard-chartered","wells-fargo","morgan-stanley","mastercard","visa-india","fiserv"]],
    ["semiconductor", ["intel-india","qualcomm","arm-india","mediatek","bosch-india","texas-instruments","samsung","samsung-india","nvidia","ericsson-india","nokia-india","cisco","oracle","sap-labs","siemens-india","walmart-global-tech","lowes-india","target-india"]],
    ["healthcare", ["apollo-247","practo","medibuddy","tata-1mg","dr-lal-pathlabs","metropolis","star-health","curefit"]],
    ["logistics", ["delhivery","shadowfax","shiprocket","rapido","blackbuck","moglix","ninjacart"]],
    ["edtech", ["scaler","vedantu","unacademy","byjus","physicswallah"]],
    ["d2c", ["godrej","nestle","hul","itc","p&g","tata-steel","purplle","licious","rebel-foods"]],
    ["ev", ["ola-electric","ather-energy","ola","cars24","spinny","tata-motors","mahindra","bajaj"]],
    ["saas", ["hasura","gupshup","exotel","plivo","intuit","mindtickle","sigmoid","tracxn","khatabook","krutrim","sarvam"]],
    ["quant", ["optiver","millennium","jane-street","de-shaw","citadel"]],
  ];
  const map: Record<string, string> = {};
  for (const [cat, companies] of groups) for (const c of companies) map[c] = cat;
  return map;
})();

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

/* Google truncates SERP titles/descriptions around ~60 and ~155 chars
   respectively. The intro's "first sentence" (naive split on ".") can run
   long when the intro itself contains abbreviations or is simply verbose,
   so this trims to the last full word that still fits instead of cutting
   mid-word or blowing past the limit. */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, "");
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return { title: "Not Found" };

  /* Keep the title under ~60 chars (Google's display window). The brand
     suffix is only worth appending when it still fits — a truncated
     "| HireStepX" is worse than no suffix at all. */
  const withSuffix = `${page.searchPhrase} | HireStepX`;
  const title = withSuffix.length <= 60 ? withSuffix : page.searchPhrase;

  const descSuffix = " Practice with AI voice feedback. 2 free sessions, no credit card.";
  const firstSentence = page.intro.split(". ")[0];
  const body = truncateAtWord(firstSentence, 155 - descSuffix.length - 1);
  const description = `${body}.${descSuffix}`;

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
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

/* ─── Deterministic publish date + author from slug ─────────────────────── */

/* Spreads pages across Jan 1 – Jul 21 2026 without touching 232 data entries.
   Hash is stable: same slug always maps to the same date across deploys. */
function slugPublishDate(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0;
  }
  const t = Math.abs(h) / 0x7fffffff;
  const from = new Date("2026-01-01").getTime();
  const to   = new Date(SEO_PAGES_LAST_MODIFIED).getTime();
  return new Date(from + t * (to - from)).toISOString().slice(0, 10);
}

function slugAuthor(_slug: string): string {
  return "HireStepX Editorial Team";
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

  /* FAQPage schema — structured Q&A data for Google's understanding.
     Note: FAQ rich results (visual accordion in SERP) were deprecated by
     Google on May 7, 2026. The schema is kept for structured-data signal;
     the HowTo schema below is the live rich-result opportunity.
     Content sourced exclusively from seo-pages.ts curated fields and the
     question bank (≥2-source verified). Framework answers attributed to
     HireStepX, not the company. */
  type FaqEntry = { "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } };
  const faqEntries: FaqEntry[] = [];

  if (page.recruitmentSteps && page.recruitmentSteps.length > 0) {
    faqEntries.push({
      "@type": "Question",
      name: `What is the recruitment process at ${companyLabel}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `The typical ${companyLabel} recruitment process has ${page.recruitmentSteps.length} stages: ${page.recruitmentSteps.join(" → ")}.`,
      },
    });
  }

  if (page.interviewRounds && page.interviewRounds.length > 0) {
    faqEntries.push({
      "@type": "Question",
      name: `What are the interview rounds at ${companyLabel}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${companyLabel} typically conducts ${page.interviewRounds.length} interview rounds: ${page.interviewRounds.join("; ")}.`,
      },
    });
  }

  faqEntries.push({
    "@type": "Question",
    name: `What framework should I use for ${companyLabel} ${focusLabel.toLowerCase()} interviews?`,
    acceptedAnswer: {
      "@type": "Answer",
      text: `HireStepX recommends the ${page.framework.name} framework for this type of interview: ${page.framework.summary}`,
    },
  });

  questions.slice(0, 8).forEach((q) => {
    faqEntries.push({
      "@type": "Question",
      name: q.text,
      acceptedAnswer: {
        "@type": "Answer",
        text: `To answer this question well, HireStepX recommends the ${page.framework.name} approach: ${page.framework.summary} Ground your answer in a specific real example from your own experience.`,
      },
    });
  });

  /* Optional extra Q&As from curated faqExtra field — content must be
     sourced from the codebase (intro, framework, known facts), never invented. */
  (page.faqExtra ?? []).forEach(({ q, a }) => {
    faqEntries.push({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    });
  });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries,
  };

  /* Visible FAQ content — passed to QuestionSetPage so the on-page FAQ
     section actually matches this page's FAQPage schema above, instead of
     a generic block repeated identically across all /questions/[slug]
     pages. Capped so the section doesn't run unreasonably long on pages
     with a big question bank. */
  const visibleFaqs = faqEntries.slice(0, 8).map((entry) => ({
    q: entry.name,
    a: entry.acceptedAnswer.text,
  }));

  /* HowTo schema (preparation) — framework summary split on → separators. */
  const howToSteps = page.framework.summary
    .split(/\s*→\s*/)
    .filter(Boolean)
    .map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.split("(")[0].trim(),
      text: step,
    }));

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to prepare for ${companyLabel} ${focusLabel.toLowerCase()} interviews`,
    description: page.intro,
    step: howToSteps,
  };

  /* HowTo schema (recruitment process) — uses recruitmentSteps when present.
     Google surfaces this as "How it works" steps on job/interview queries.
     Kept separate from the preparation HowTo so both signal types coexist. */
  const recruitmentHowToSchema = page.recruitmentSteps && page.recruitmentSteps.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `${companyLabel} interview process — step by step`,
    description: `A step-by-step breakdown of the ${companyLabel} ${focusLabel.toLowerCase()} interview process for candidates in India.`,
    step: page.recruitmentSteps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.split("—")[0].split("(")[0].trim(),
      text: step,
    })),
  } : null;

  /* Article schema — signals editorial content, not a thin landing page.
     image is required for Google Discover/News eligibility. */
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.searchPhrase,
    description: page.intro,
    image: `https://hirestepx.com/questions/${slug}/opengraph-image`,
    author: {
      "@type": "Organization",
      name: slugAuthor(slug),
      url: "https://hirestepx.com/about",
    },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: slugPublishDate(slug),
    dateModified: SEO_PAGES_LAST_MODIFIED,
    inLanguage: "en-IN",
    url: `https://hirestepx.com/questions/${slug}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hirestepx.com/questions/${slug}` },
    articleSection: focusLabel,
    keywords: [page.metaKeywords[0], companyLabel, "interview preparation India"].join(", "),
  };

  /* Related pages: (1) same company, (2) same category peers, (3) same focus. */
  const pageCategory = CATEGORY[page.company];
  const sameCompany = SEO_PAGES.filter((p: SeoPage) => p.slug !== slug && p.company === page.company);
  const sameCat = pageCategory
    ? SEO_PAGES.filter((p: SeoPage) => p.slug !== slug && p.company !== page.company && CATEGORY[p.company] === pageCategory)
    : [];
  const sameFocus = SEO_PAGES.filter(
    (p: SeoPage) => p.slug !== slug && p.company !== page.company && CATEGORY[p.company] !== pageCategory && p.focus === page.focus,
  );
  const relatedPages = [...sameCompany, ...sameCat, ...sameFocus]
    .slice(0, 4)
    .map((p: SeoPage) => ({ slug: p.slug, searchPhrase: p.searchPhrase }));

  /* Salary page cross-link — show when a /salary/[company] page exists for this company. */
  const salaryPage = getSalaryPage(page.company);

  /* Related blog posts: same company (BLOG_META.company is title-case, SEO company is lowercase). */
  const relatedBlogPosts = BLOG_META
    .filter((post) => post.company.toLowerCase() === page.company)
    .slice(0, 3)
    .map((post) => ({ slug: post.slug, title: post.title }));

  return (
    <>
      {/* Structured data */}
      <script
        nonce={nonce || undefined}
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(faqSchema)}
      />
      {howToSteps.length > 0 && (
        <script
          nonce={nonce || undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(howToSchema)}
        />
      )}
      {recruitmentHowToSchema && (
        <script
          nonce={nonce || undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(recruitmentHowToSchema)}
        />
      )}
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

      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <NavV2 />
      {/* Page body */}
      <QuestionSetPage
        slug={slug}
        page={page}
        questions={questions}
        companyLabel={companyLabel}
        focusLabel={focusLabel}
        relatedPages={relatedPages}
        relatedBlogPosts={relatedBlogPosts}
        salaryPageSlug={salaryPage?.slug}
        faqs={visibleFaqs}
      />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
