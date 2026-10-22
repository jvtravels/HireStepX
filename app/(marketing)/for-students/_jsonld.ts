import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /for-students's JSON-LD, used by both the
 * page (renders it, including looping over faqSchema.mainEntity for the
 * visible FAQ section) and scripts/generate-jsonld-csp-hashes.mts (hashes
 * the JSON-LD for the CSP header). Keeping this in one place guarantees
 * the hash always matches what the page actually renders. */

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How early should I start preparing for campus placements in India?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Start 3–4 months before your placement season for service companies (TCS, Infosys, Wipro). For product companies (Flipkart, Swiggy, CRED), start 6–8 months early due to the higher DSA and system design bar. The aptitude round for service companies eliminates 60–80% of candidates, making it the highest-leverage area to prepare first.",
      },
    },
    {
      "@type": "Question",
      name: "What CGPA is required for campus placements in India?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most service companies have a 6.0 CGPA minimum; many have 6.5 or 7.0. TCS requires 60% throughout academics with no active backlogs. Some product companies don't have a CGPA filter at all, so check each company's specific eligibility criteria on their careers page or official campus portal before assuming you're ineligible.",
      },
    },
    {
      "@type": "Question",
      name: "What rounds are in a typical campus placement process?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A typical Indian campus placement process has 3–5 rounds: (1) Aptitude / Online Test: reasoning, quantitative, verbal, and basic coding questions that eliminate most applicants; (2) Technical Interview: CS fundamentals, data structures, and sometimes a coding problem; (3) Group Discussion (some companies); (4) HR Round: behavioral questions including 'tell me about yourself', 'why should we hire you', and salary expectation; (5) Offer roll-out.",
      },
    },
    {
      "@type": "Question",
      name: "Which companies hire the most freshers in India?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TCS, Infosys, Wipro, Cognizant, Accenture, HCL Technologies, and Capgemini are the largest campus recruiters in India, collectively hiring more than 100,000 freshers per year. Each company has a distinct aptitude test format: TCS uses the NQT, Wipro uses the NLTH assessment, and Cognizant uses the GenC/GenC Next format.",
      },
    },
    {
      "@type": "Question",
      name: "What is the most important thing to prepare for an HR interview in campus placements?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The three questions that appear in 95%+ of fresher HR rounds are: 'Tell me about yourself', 'Why should we hire you?', and 'What is your greatest strength?' Prepare a structured 60–90 second answer for 'tell me about yourself' using the Present → Achievement → Future format, not a chronological biography. The 'why should we hire you' answer needs the Skills → Proof → Fit structure with at least one specific, measurable proof point.",
      },
    },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Campus Placement Interview Preparation Guide India 2026",
  description: "Complete campus placement interview preparation guide for Indian college students covering aptitude, technical, group discussion, and HR rounds for TCS, Infosys, Wipro, Cognizant, Accenture, HCL, and Capgemini.",
  image: "https://hirestepx.com/opengraph-image",
  author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
  publisher: {
    "@type": "Organization", name: "HireStepX",
    logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
  },
  datePublished: "2026-01-01",
  dateModified: "2026-07-15",
  inLanguage: "en-IN",
  url: "https://hirestepx.com/for-students",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://hirestepx.com/for-students" },
  keywords: "campus placement interview preparation India 2026, fresher interview India, campus placement guide",
  articleSection: "Campus Placement",
};

export function buildForStudentsJsonLd(): { __html: string }[] {
  return [
    ldJson(articleSchema),
    ldJson(faqSchema),
    ldJson(breadcrumb([{ name: "For Students", path: "/for-students" }])),
  ];
}
