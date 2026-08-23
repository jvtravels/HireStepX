import { getSeoPageBySlug, SEO_PAGES, SEO_PAGES_LAST_MODIFIED, type SeoPage } from "../../../../data/seo-pages";
import { getSalaryPage } from "../../../../data/salary-seo";
import { QUESTION_BANK, type BankEntry } from "../../../../data/interview-question-bank";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { COMPANY_LABEL } from "../../../../data/company-labels";
import { BLOG_META } from "../../../../src/blog-meta";

/* Shared source of truth for /questions/[slug]'s data + JSON-LD, used by
 * both the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes the JSON-LD for the CSP header). Keeping this in one place
 * guarantees the hash always matches what the page actually renders. */

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

/* tier 1/2 = questions genuinely tied to this company (exact roleFamily,
   or at least exact company+focus). tier 3 = the company has too few
   bank entries for this focus, so the list falls back to other
   companies' questions on the same focus — real, useful questions, but
   not "asked at {company}". The page copy must not claim company
   attribution it can't back for tier 3 (see AdSense policy 10015918:
   pages must deliver what they promise, not misattribute content). */
function questionsForPage(p: SeoPage): { questions: BankEntry[]; tier: 1 | 2 | 3 } {
  const exact = QUESTION_BANK.filter(
    (q) =>
      q.company === p.company &&
      q.focus === p.focus &&
      (!p.roleFamily || q.roleFamily === p.roleFamily),
  );
  if (exact.length >= 4) return { questions: exact.slice(0, 12), tier: 1 };

  const noRole = QUESTION_BANK.filter(
    (q) => q.company === p.company && q.focus === p.focus,
  );
  if (noRole.length >= 4) return { questions: noRole.slice(0, 12), tier: 2 };

  return { questions: QUESTION_BANK.filter((q) => q.focus === p.focus).slice(0, 12), tier: 3 };
}

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

export function buildQuestionsPageModel(slug: string) {
  const page = getSeoPageBySlug(slug);
  if (!page) return null;

  const { questions, tier } = questionsForPage(page);
  const questionsAreCompanySpecific = tier !== 3;
  const companyLabel = COMPANY_LABEL[page.company] ?? page.company;
  const focusLabel = FOCUS_LABEL[page.focus] ?? page.focus;

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

  const visibleFaqs = faqEntries.slice(0, 8).map((entry) => ({
    q: entry.name,
    a: entry.acceptedAnswer.text,
  }));

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

  const salaryPage = getSalaryPage(page.company);

  const relatedBlogPosts = BLOG_META
    .filter((post) => post.company.toLowerCase() === page.company)
    .slice(0, 3)
    .map((post) => ({ slug: post.slug, title: post.title }));

  const jsonLdScripts: { __html: string }[] = [ldJson(faqSchema)];
  if (howToSteps.length > 0) jsonLdScripts.push(ldJson(howToSchema));
  if (recruitmentHowToSchema) jsonLdScripts.push(ldJson(recruitmentHowToSchema));
  jsonLdScripts.push(ldJson(articleSchema));
  jsonLdScripts.push(
    ldJson(
      breadcrumb([
        { name: "Questions", path: "/questions" },
        { name: page.searchPhrase, path: `/questions/${slug}` },
      ]),
    ),
  );

  return {
    page,
    questions,
    questionsAreCompanySpecific,
    companyLabel,
    focusLabel,
    visibleFaqs,
    relatedPages,
    salaryPage,
    relatedBlogPosts,
    jsonLdScripts,
  };
}
