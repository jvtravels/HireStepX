/* Shared by the server matcher and the employer candidate screen so both
   agree on what counts as "the same skill" ("React.js" vs "React", "JS" vs
   "JavaScript"). Pure, no DOM or Node APIs. */

const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  golang: "go",
  k8s: "kubernetes",
  postgres: "postgresql",
  psql: "postgresql",
  mongo: "mongodb",
  gcp: "googlecloud",
  "google cloud": "googlecloud",
  "google cloud platform": "googlecloud",
  "amazon web services": "aws",
  ml: "machinelearning",
  "machine learning": "machinelearning",
  "power bi": "powerbi",
  "ms excel": "excel",
  "microsoft excel": "excel",
};

/* A generic skill a posting asks for is met by any specific member of its
   family: "SQL" is what a PostgreSQL or MySQL engineer has. */
const FAMILY_MEMBERS: Record<string, readonly string[]> = {
  sql: ["postgresql", "mysql", "sql server", "sqlite", "mariadb", "plsql", "pl/sql", "t-sql", "tsql"],
  machinelearning: ["scikit-learn", "scikit learn", "sklearn", "tensorflow", "pytorch", "keras", "xgboost"],
};

/** Canonical family keys a listed skill belongs to ("PostgreSQL" -> ["sql"]),
 *  so a gate comparing a posting's generic skill with a specific one can treat
 *  them as the same. */
export function skillFamilyKeys(raw: string): string[] {
  const key = skillKey(raw);
  return Object.keys(FAMILY_MEMBERS).filter((family) => FAMILY_MEMBERS[family].includes(key));
}

const PHRASE_ALIASES = Object.keys(ALIASES)
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length);
const PHRASE_RE = new RegExp(`(?<![a-z0-9])(${PHRASE_ALIASES.map(escapeRegExp).join("|")})(?![a-z0-9])`, "g");

/** Collapses multi-word aliases ("Machine Learning", "Power BI") to their one
 *  canonical token. Must run before text is split into words, or the phrase
 *  can never be seen. */
export function canonicalizePhrases(text: string): string {
  return text.toLowerCase().replace(PHRASE_RE, (m) => ALIASES[m] ?? m);
}

/** One lowercase token (as produced by the matcher's tokenizer). */
export function canonicalSkillToken(token: string): string {
  let t = token.toLowerCase().replace(/\.+$/, "");
  if (t.length > 4 && t.endsWith(".js")) t = t.slice(0, -3);
  else if (t.length > 5 && t.endsWith("js") && /^(react|node|vue|next|nuxt|express|nest|angular)js$/.test(t)) t = t.slice(0, -2);
  return ALIASES[t] ?? t;
}

/** Comparable identity for a free-text skill name. */
export function skillKey(raw: string): string {
  const cleaned = canonicalizePhrases(raw)
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const whole = ALIASES[cleaned];
  if (whole) return whole;
  return cleaned
    .split(" ")
    .map(canonicalSkillToken)
    .join(" ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Required skills the candidate demonstrably has: listed in their skills
 *  (compared by normalized key) or named as a whole word in `corpus`
 *  (resume bullets, summary and similar free text). */
export function matchRequiredSkills(required: string[], candidateSkills: string[], corpus = ""): string[] {
  const have = new Set(candidateSkills.map(skillKey));
  const text = canonicalizePhrases(corpus);
  return required.filter((req) => {
    const key = skillKey(req);
    if (!key) return false;
    if (have.has(key)) return true;
    if (FAMILY_MEMBERS[key]?.some((member) => have.has(member))) return true;
    if (!text) return false;
    const variants = new Set([canonicalizePhrases(req).trim(), key]);
    for (const v of variants) {
      const re = new RegExp(`(?<![a-z0-9+#])${escapeRegExp(v)}(?![a-z0-9+#])`, "i");
      if (re.test(text)) return true;
    }
    return false;
  });
}
