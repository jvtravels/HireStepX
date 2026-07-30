/* HireStepX — City-specific interview prep pages: /interview-prep/[city]
 *
 * Targets "interview preparation Bangalore", "mock interview practice
 * Hyderabad" style queries — a gap the company × focus SEO tree
 * (data/seo-pages.ts) doesn't cover, since those pages target a specific
 * employer, not a candidate searching by location.
 *
 * Company lists are cross-referenced against real office locations noted
 * in data/company-known-facts.ts (not invented), filtered to companies
 * that already have a SEO_PAGES entry so every link resolves to real
 * content. Curation rule: only companies with a verifiable known office
 * in that city per company-known-facts.ts.
 */

export interface CityPage {
  slug: string;
  city: string;
  /* Broader metro area name used in copy, e.g. "Bengaluru" vs "Bangalore". */
  displayName: string;
  intro: string;
  hiringContext: string;
  /* Company keys — must exist in data/seo-pages.ts SEO_PAGES. */
  companies: string[];
}

export const CITY_PAGES: CityPage[] = [
  {
    slug: "bengaluru",
    city: "Bengaluru",
    displayName: "Bengaluru (Bangalore)",
    intro: "Bengaluru is India's largest technology hiring market by volume, home to Global Capability Centres (GCCs) for most major US tech and finance companies alongside the country's biggest product startups. If you're interviewing here, your prep needs to match which of these two very different hiring cultures you're walking into.",
    hiringContext: "GCCs (Google, Microsoft, Meta, Oracle, Salesforce, Atlassian, Uber) tend to run structured, rubric-driven loops close to their global interview bar: strong DSA, system design, and behavioral rounds mapped to specific levels. Indian product companies and fintech startups headquartered in the city (Groww, Cashfree, Truecaller, Sharechat, Moengage) often move faster, with less standardized rubrics and more emphasis on ownership and product sense in addition to core technical skill.",
    companies: [
      "google", "microsoft", "meta", "oracle", "salesforce", "atlassian", "uber", "netflix", "apple",
      "groww", "cashfree", "truecaller", "sharechat", "juspay", "postman", "linkedin", "stripe",
    ],
  },
  {
    slug: "hyderabad",
    city: "Hyderabad",
    displayName: "Hyderabad",
    intro: "Hyderabad has grown into one of the largest GCC hubs in India, with several US tech and finance companies running their single biggest India engineering site out of the city rather than treating it as a secondary office.",
    hiringContext: "Companies like Google, Microsoft, Salesforce, Qualcomm, ServiceNow, and Workday run large, mature Hyderabad campuses, which means interview loops here are typically as structured and level-aware as their US counterparts, not a scaled-down regional version. Financial-services GCCs (JPMorgan, HSBC) and IT services firms (Thoughtworks, GlobalLogic) also hire heavily in the city.",
    companies: [
      "google", "microsoft", "salesforce", "qualcomm", "servicenow", "workday", "oracle", "nvidia",
      "jpmc", "hsbc", "thoughtworks", "globallogic", "apple", "citadel",
    ],
  },
  {
    slug: "pune",
    city: "Pune",
    displayName: "Pune",
    intro: "Pune's hiring market splits between banking-technology GCCs and a strong enterprise-software and IT-services base, giving it a different interview mix than Bengaluru or Hyderabad's consumer-tech-heavy loops.",
    hiringContext: "Barclays, Citi, and HSBC run significant banking-technology centres in Pune focused on investment-banking platforms, risk, and compliance systems. Enterprise and infrastructure companies (VMware, Nvidia, Mastercard, Fiserv) and IT services firms (Thoughtworks, GlobalLogic) round out the base, alongside SaaS players like Druva and Mindtickle.",
    companies: [
      "barclays", "citi", "hsbc", "vmware", "nvidia", "mastercard", "fiserv", "thoughtworks",
      "globallogic", "druva", "mindtickle", "ey",
    ],
  },
  {
    slug: "chennai",
    city: "Chennai",
    displayName: "Chennai",
    intro: "Chennai's tech hiring market is smaller than Bengaluru or Hyderabad's but has real depth in specific niches: banking technology, SaaS, and semiconductor-adjacent roles.",
    hiringContext: "Citi and Barclays run banking-technology operations in the city, Qualcomm has an engineering presence tied to its broader India chipset work, and Chennai-headquartered SaaS companies (Chargebee, Freshworks) hire directly for product engineering roles rather than GCC-style delivery work.",
    companies: [
      "citi", "barclays", "qualcomm", "chargebee", "freshworks", "thoughtworks", "nium",
    ],
  },
  {
    slug: "mumbai",
    city: "Mumbai",
    displayName: "Mumbai",
    intro: "Mumbai's hiring market is anchored in banking and financial services, consulting, and FMCG/retail, alongside a growing fintech and D2C startup base, a genuinely different mix from the engineering-GCC-heavy cities.",
    hiringContext: "India's largest private banks (HDFC, Axis, Kotak) and global banks (Citi, HSBC) hire heavily for both tech and core banking roles here, alongside consulting firms (EY, KPMG, PwC) and FMCG/consumer companies (HUL, Godrej, Mahindra). Fintech (Jupiter) and D2C/retail (DMart, Purplle) add a startup layer to the mix.",
    companies: [
      "hdfc", "axis", "kotak", "citi", "hsbc", "ey", "kpmg", "pwc", "hul", "godrej", "mahindra",
      "jupiter", "dmart", "purplle", "openai",
    ],
  },
  {
    slug: "delhi-ncr",
    city: "Delhi NCR",
    displayName: "Delhi NCR",
    intro: "Delhi NCR (Delhi, Gurugram, and Noida) is India's second-largest hiring hub after Bengaluru, but with a very different composition: travel-tech, quick-commerce, logistics, and edtech companies headquartered here dominate over GCC-style delivery work.",
    hiringContext: "Gurugram is home to travel and consumer-tech companies (MakeMyTrip, Ixigo, Cars24, Spinny) and fintech/insurance-tech (PolicyBazaar, IndMoney, BharatPe), alongside GCCs for KPMG and Nestle. Noida adds Microsoft, Adobe, and IT services firms (Thoughtworks, GlobalLogic), plus Naukri.com and edtech player Byju's. Delhi and the wider NCR belt add a dense logistics cluster (Delhivery, Shadowfax, Blackbuck, Rivigo), quick-commerce (Blinkit), and consulting (EY).",
    companies: [
      "makemytrip", "ixigo", "cars24", "spinny", "policybazaar", "indmoney", "bharatpe", "kpmg",
      "microsoft", "adobe", "thoughtworks", "globallogic", "naukri", "byjus", "moglix",
      "delhivery", "shadowfax", "blackbuck", "rivigo", "blinkit", "ey", "boat", "niyo", "yulu",
    ],
  },
];

export function getCityPageBySlug(slug: string): CityPage | undefined {
  return CITY_PAGES.find((c) => c.slug === slug);
}

export function getAllCitySlugs(): string[] {
  return CITY_PAGES.map((c) => c.slug);
}
