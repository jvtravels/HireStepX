/* HireStepX — PII scrubbing before third-party LLM calls

   Resume text and interview transcripts are sent to external model
   processors (Groq, Google Gemini, Cloudflare Workers AI). To minimise
   the personal data those processors see (DPDP Act data-minimisation),
   high-risk identifiers are swapped for stable placeholders such as
   [EMAIL_1] before the prompt leaves our infrastructure, and swapped back
   in the model's reply with restorePii().

   Deliberately NOT scrubbed: person names, employer / college names, city
   names and the substance of interview answers — the models need them to
   do the job. Every pattern below is tuned to avoid eating years, salaries
   (₹12,00,000 / 12 LPA), percentages, CGPA and version numbers. Where a
   bare digit run is ambiguous it is only scrubbed when it carries a label
   ("Aadhaar", "A/c no.", "passport") or passes a checksum (Luhn, Verhoeff).

   Pure and edge-safe: no Node APIs. */

export type PiiKind =
  | "EMAIL"
  | "PHONE"
  | "AADHAAR"
  | "PAN"
  | "PASSPORT"
  | "BANK_ACCT"
  | "IFSC"
  | "CARD"
  | "UPI"
  | "ADDRESS"
  | "PIN"
  | "DOB"
  | "LINKEDIN"
  | "GITHUB";

export interface ScrubOptions {
  /** Kinds to leave untouched. */
  skip?: readonly PiiKind[];
}

export interface ScrubResult {
  text: string;
  /** placeholder (e.g. "[EMAIL_1]") → original value */
  map: Record<string, string>;
}

const MONTHS = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

const UPI_HANDLES =
  "(?:ok(?:hdfcbank|icici|sbi|axis)|ybl|ibl|axl|apl|paytm|upi|sbi|hdfcbank|icici|axisbank|pnb|boi|cnrb|ikwik|fbl|airtel|jio|postbank|kotak|idfcbank|aubank|yesbank|barodampay|rbl|dbs|federal|freecharge|pingpay|waicici|waaxis|wahdfcbank|wasbi|ezeepay|abfspay|cmsidfc|jupiteraxis|fam|slice|tapicici|yapl|gpay|phonepe|ptsbi|pthdfc|ptaxis|ptyes)";
const UPI_RE = new RegExp(`(?<![\\w.@-])[A-Za-z0-9._-]{2,64}@${UPI_HANDLES}(?![\\w@-]|\\.\\w)`, "gi");

const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_%.-]+\/?/gi;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/(?!orgs\/|features\/|about\b|pricing\b|topics\/|marketplace\b|sponsors\b)[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?![A-Za-z0-9-])/gi;

const DATE_PATTERN =
  `(?:\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-](?:\\d{4}|\\d{2})` +
  `|\\d{4}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{1,2}` +
  `|\\d{1,2}(?:st|nd|rd|th)?[\\s,.\\-]+${MONTHS}\\.?[\\s,.\\-]+\\d{4}` +
  `|${MONTHS}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})`;
const DOB_RE = new RegExp(
  `((?:\\bD\\.?\\s?O\\.?\\s?B\\b\\.?|\\bdate\\s+of\\s+birth\\b|\\bbirth\\s?date\\b|\\bbirthday\\b|\\bborn(?:\\s+on)?\\b)\\s*[:\\-–—]?\\s*)(${DATE_PATTERN})`,
  "gi",
);

const LABELLED_AADHAAR_RE = /(\b(?:aadhaar|aadhar|adhaar|adhar|uidai|uid)\b(?:\s*(?:card|number|no\.?|num|#))*\s*[:#.\-–]?\s*)(\d{4}[\s-]?\d{4}[\s-]?\d{4})(?!\d)/gi;
const LABELLED_BANK_RE = /(\b(?:a\/c|acct?\.?|account)\s*(?:no\.?|number|num|#)?\s*[:#.\-–]?\s*)(\d{9,18})(?!\d)/gi;
const LABELLED_PASSPORT_RE = /(\bpassport\b(?:\s*(?:no\.?|number|num|#))*\s*[:#.\-–]?\s*)([A-Z0-9]{6,9})\b/gi;
const LABELLED_PIN_RE = /(\b(?:(?:pin\s?code|postal\s+code|zip(?:\s?code)?)\b\s*[:#.\-–]?|pin\b\s*[:#\-–])\s*)([1-9]\d{2}\s?\d{3})(?!\d)/gi;

const CARD_RE = /(?<![\d.,])(?:\d{13,19}|\d{4}([ -])\d{4}\1\d{4}\1\d{1,7}|\d{4}([ -])\d{6}\2\d{4,5})(?![\d]|[.,]\d)/g;
const AADHAAR_GROUPED_RE = /(?<![\d.,])[2-9]\d{3}([ -])\d{4}\1\d{4}(?![\d]|[.,]\d|\1\d)/g;
const AADHAAR_BARE_RE = /(?<![\d.,])[2-9]\d{11}(?![\d]|[.,]\d)/g;
const PAN_RE = /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g;
const IFSC_RE = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;

const IN_PHONE_RE = /(?<![\d.,₹$\w])(?:(?:\+|00)?91[\s-]?)?0?(?:[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]\d{3}[\s-]\d{4}|[6-9]\d{2}\d{3}[\s-]\d{4})(?![\d]|[.,]\d)/g;
const INTL_PHONE_RE = /(?<![\w+])\+\d{1,3}(?:[\s.-]?\(?\d{2,5}\)?){2,4}(?![\d]|[.,]\d)/g;

const ADDRESS_LABEL_RE = /^(\s*(?:(?:permanent|current|present|residential|correspondence|home|mailing)\s+)?(?:address|residence|addr)\b\s*(?:\([^)]*\))?\s*[:\-–]\s*)(\S.*)$/i;
const ADDRESS_KEYWORD_RE = /\b(?:road|rd\.|street|lane|nagar|colony|sector|block|flat|apartments?|apt\.|plot|h\.?\s?no\.?|door\s+no|layout|society|towers?|phase|village|taluk|tehsil|post\s+office|dist(?:rict)?\.)/i;
const ADDRESS_UNIT_RE = /^\s*(?:flat|plot|h\.?\s?no\.?|house\s+no\.?|door\s+no\.?|room)\s*[#:.-]?\s*[\w/-]+\s*,/i;
const PIN_IN_LINE_RE = /(?<![\d.,])[1-9]\d{2}\s?\d{3}[\s,.;-]*(?:india)?[\s.]*$/i;
const ADDRESS_LINE_MAX = 220;

const DIGITS_RE = /\D/g;

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidVerhoeff(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(rev[i])]];
  return c === 0;
}

export function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function isYearGroup(g: string): boolean {
  return g.length === 4 && /^(?:19[5-9]\d|20\d\d)$/.test(g);
}

function allYears(raw: string): boolean {
  const groups = raw.split(/[\s-]+/).filter(Boolean);
  return groups.length > 1 && groups.every(isYearGroup);
}

function isCardShaped(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  if (!/^(?:[3-6]|8[12])/.test(digits)) return false;
  return isValidLuhn(digits);
}

class Scrubber {
  readonly map: Record<string, string> = {};
  private readonly byValue = new Map<string, string>();
  private readonly counters = new Map<PiiKind, number>();

  constructor(private readonly skip: ReadonlySet<PiiKind>) {}

  enabled(kind: PiiKind): boolean {
    return !this.skip.has(kind);
  }

  placeholder(kind: PiiKind, value: string): string {
    const key = `${kind}|${kind === "EMAIL" || kind === "UPI" ? value.toLowerCase() : value.replace(/\s+/g, " ").trim()}`;
    const existing = this.byValue.get(key);
    if (existing) return existing;
    const n = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, n);
    const ph = `[${kind}_${n}]`;
    this.map[ph] = value;
    this.byValue.set(key, ph);
    return ph;
  }

  sub(text: string, kind: PiiKind, re: RegExp, accept?: (match: string) => boolean): string {
    if (!this.enabled(kind)) return text;
    return text.replace(re, (m) => (accept && !accept(m) ? m : this.placeholder(kind, m)));
  }

  subLabelled(text: string, kind: PiiKind, re: RegExp, accept?: (value: string) => boolean): string {
    if (!this.enabled(kind)) return text;
    return text.replace(re, (_m, label: string, value: string) =>
      accept && !accept(value) ? label + value : label + this.placeholder(kind, value),
    );
  }
}

function scrubAddresses(text: string, s: Scrubber): string {
  if (!s.enabled("ADDRESS")) return text;
  return text
    .split("\n")
    .map((line) => {
      if (line.length > ADDRESS_LINE_MAX) return line;
      const labelled = ADDRESS_LABEL_RE.exec(line);
      if (labelled) return labelled[1] + s.placeholder("ADDRESS", labelled[2].trim());
      const trimmed = line.trim();
      if (!trimmed || /\[[A-Z_]+_\d+\]/.test(trimmed) && trimmed.replace(/\[[A-Z_]+_\d+\]/g, "").trim().length < 3) return line;
      if ((line.match(/,/g) ?? []).length < 2) return line;
      const addressLike = ADDRESS_UNIT_RE.test(line) || (ADDRESS_KEYWORD_RE.test(line) && PIN_IN_LINE_RE.test(line));
      if (!addressLike) return line;
      const indent = line.slice(0, line.length - line.trimStart().length);
      return indent + s.placeholder("ADDRESS", trimmed);
    })
    .join("\n");
}

function scrubPhones(text: string, s: Scrubber): string {
  if (!s.enabled("PHONE")) return text;
  let out = text.replace(IN_PHONE_RE, (m) => {
    const digits = m.replace(DIGITS_RE, "");
    if (/0{5}$/.test(digits) || /^(\d)\1+$/.test(digits)) return m;
    return s.placeholder("PHONE", m.trim());
  });
  out = out.replace(INTL_PHONE_RE, (m) => {
    const n = m.replace(DIGITS_RE, "").length;
    if (n < 8 || n > 15) return m;
    return s.placeholder("PHONE", m.trim());
  });
  return out;
}

export function scrubPii(text: string, opts: ScrubOptions = {}): ScrubResult {
  if (!text || typeof text !== "string") return { text: text ?? "", map: {} };
  const s = new Scrubber(new Set(opts.skip ?? []));
  let out = text;

  out = s.sub(out, "EMAIL", EMAIL_RE);
  out = s.sub(out, "LINKEDIN", LINKEDIN_RE);
  out = s.sub(out, "GITHUB", GITHUB_RE);
  out = s.sub(out, "UPI", UPI_RE);

  if (s.enabled("DOB")) {
    out = out.replace(DOB_RE, (_m, label: string, date: string) => label + s.placeholder("DOB", date));
  }
  out = s.subLabelled(out, "AADHAAR", LABELLED_AADHAAR_RE);
  out = s.subLabelled(out, "BANK_ACCT", LABELLED_BANK_RE);
  out = s.subLabelled(out, "PASSPORT", LABELLED_PASSPORT_RE, (v) => /\d/.test(v));

  out = s.sub(out, "CARD", CARD_RE, (m) => !allYears(m) && isCardShaped(m.replace(DIGITS_RE, "")));
  out = s.sub(out, "AADHAAR", AADHAAR_GROUPED_RE, (m) => !allYears(m));
  out = s.sub(out, "AADHAAR", AADHAAR_BARE_RE, isValidVerhoeff);
  out = s.sub(out, "PAN", PAN_RE);
  out = s.sub(out, "IFSC", IFSC_RE);

  out = scrubAddresses(out, s);
  out = scrubPhones(out, s);
  out = s.subLabelled(out, "PIN", LABELLED_PIN_RE);

  return { text: out, map: s.map };
}

const PLACEHOLDER_RE = /\[\s*([A-Za-z_]+?)[_\s-]?(\d+)\s*\]/g;

export interface RestoreOptions {
  /** Escape restored values so they stay valid inside a JSON string literal. */
  json?: boolean;
}

export function restorePii(text: string, map: Record<string, string>, opts: RestoreOptions = {}): string {
  if (!text || typeof text !== "string") return text;
  if (Object.keys(map).length === 0) return text;
  return text.replace(PLACEHOLDER_RE, (m, kind: string, n: string) => {
    const original = map[`[${kind.toUpperCase()}_${n}]`];
    if (original === undefined) return m;
    return opts.json ? JSON.stringify(original).slice(1, -1) : original;
  });
}
