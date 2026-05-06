/**
 * Company → primary-city mapping.
 *
 * Used as a default suggestion for `jobCity` in `salary-lookup.ts` when
 * the user picks a target company but hasn't yet specified where the
 * role is based. Maps to the city the company is HQ'd or has its
 * largest engineering / design / product presence in.
 *
 * Keys: lowercase, trimmed. Same conventions as company-tiers.ts so
 * the two maps can be looked up with the same key.
 *
 * City values: human-readable, single primary city. For multi-city
 * companies (e.g. Robosoft Udupi-HQ + Bangalore-office), pick the
 * city most candidates would interview in. Use comments to note
 * secondary cities.
 *
 * Coverage focus: Indian design agencies / UX studios — the primary
 * use case. Add other companies as needed.
 */

export type CompanyCity = string; // human-readable city name (e.g. "Bangalore", "Mumbai")

const COMPANY_CITY_MAP: Record<string, CompanyCity> = {
  // ─── India design studios — Bangalore ───
  "lollypop design studio": "Bangalore",
  lollypop: "Bangalore",
  f1studioz: "Bangalore",
  "netbramha studios": "Bangalore",
  netbramha: "Bangalore",
  "pepper square": "Bangalore",
  geekyants: "Bangalore",
  humanx: "Bangalore",
  thence: "Bangalore",
  "red baton": "Bangalore",
  goodworklabs: "Bangalore",
  goprotoz: "Bangalore",
  "origin ux studio": "Bangalore",
  "studio graphene": "Bangalore", // also London HQ
  "atoll solutions": "Bangalore",
  rillusion: "Bangalore",
  "futuristic labs design": "Bangalore",
  "futuristic labs": "Bangalore",
  simpleplan: "Bangalore",
  "parallel labs": "Bangalore",
  // Robosoft is HQ'd in Udupi per Dun & Bradstreet / Tracxn / ZaubaCorp.
  // Bangalore is a delivery office but the registered HQ is Udupi.
  "robosoft technologies": "Udupi",
  robosoft: "Udupi",

  // ─── India design studios — Mumbai ───
  procreator: "Mumbai",
  "yellow slice": "Mumbai",
  "fractal ink": "Mumbai",
  ungrammary: "Mumbai",
  yellowchalk: "Mumbai",
  "techved consulting": "Mumbai",
  techved: "Mumbai",
  userfacet: "Mumbai",
  silverscoop: "Mumbai",
  screenroot: "Mumbai",
  "interactive avenues": "Mumbai",
  "lights out studio": "Mumbai",
  "think design": "Mumbai", // also Pune
  "bc web wise": "Mumbai",
  // ZEUX Innovation HQ: Hiranandani Gardens, Mumbai 400076 (LinkedIn, ZoomInfo).
  "zeux innovation": "Mumbai",
  zeux: "Mumbai",

  // ─── India design studios — Pune ───
  "yuj designs": "Pune",
  yuj: "Pune",
  monsoonfish: "Pune",
  "koru ux design": "Pune",
  "koru ux": "Pune",
  extentia: "Pune",

  // ─── India design studios — Hyderabad ───
  "divami design labs": "Hyderabad",
  divami: "Hyderabad",
  "mutual mobile": "Hyderabad", // also Austin HQ
  purpletalk: "Hyderabad",
  inovies: "Hyderabad",
  "fission labs design": "Hyderabad",
  "fission labs": "Hyderabad",
  "tvisha technologies": "Hyderabad",
  tvisha: "Hyderabad",
  "digital shout": "Hyderabad",

  // ─── India design studios — Ahmedabad ───
  "octet design studio": "Ahmedabad",
  octet: "Ahmedabad",
  "codal india": "Ahmedabad",
  codal: "Ahmedabad",
  "communication crafts": "Ahmedabad",
  "aubergine solutions": "Ahmedabad",
  aubergine: "Ahmedabad",
  "tatvasoft design": "Ahmedabad",
  tatvasoft: "Ahmedabad",
  "shaligram infotech design": "Ahmedabad",
  "shaligram infotech": "Ahmedabad",
  pixlogix: "Ahmedabad",

  // ─── India design studios — NCR (Delhi / Gurgaon / Noida) ───
  sparklin: "Gurgaon",
  quovantis: "Noida",
  neuronimbus: "Gurgaon",
  "kreativ street design": "Delhi",
  "kreativ street": "Delhi",
  "onething design": "Gurgaon", // also Bangalore office
  onething: "Gurgaon",

  // ─── India design studios — Chennai ───
  "ionixx technologies": "Chennai",
  ionixx: "Chennai",
  "latentview design team": "Chennai",
  "hakuna matata solutions": "Chennai", // also Madurai
  "hakuna matata": "Chennai",

  // ─── India design studios — Kerala ───
  // Aufait UX active hiring location is Calicut per Indeed listings + their
  // careers page. (Earlier mapping to Trivandrum was incorrect.)
  "aufait ux": "Calicut",
  aufait: "Calicut",
  wowmakers: "Kochi",

  // ─── India design studios — Other ───
  "capital numbers": "Kolkata",
  "konstant infosolutions": "Jaipur",
  konstant: "Jaipur",
  upclues: "Surat",
  netclues: "Gandhinagar",
};

/**
 * Look up the primary city for a company.
 * Returns null if no mapping exists (caller should fall back to
 * user-provided `jobCity` or omit the city dimension entirely).
 */
export function getCompanyCity(company: string | undefined | null): CompanyCity | null {
  if (!company) return null;
  const key = company.trim().toLowerCase();
  return COMPANY_CITY_MAP[key] ?? null;
}

/** For tests / debugging only. */
export const __COMPANY_CITY_MAP_INTERNAL = COMPANY_CITY_MAP;
