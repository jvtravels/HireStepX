/* Pure employer trust rules — verification tiers, per-tier limits, and the
 * free-mail check. No I/O: everything here is unit-tested directly
 * (src/__tests__/employerTrust.test.ts). Handlers load the employers row +
 * auth user and pass plain values in.
 *
 * Tiers gate DANGEROUS capabilities (buying contact details, messaging), not
 * signup — signup stays self-serve:
 *   basic          signed up with a free-mail address, no admin verification
 *   email_verified confirmed sign-in email on a company (non-free-mail) domain
 *   verified       email's registrable domain EQUALS the website's registrable
 *                  domain (public-suffix aware, no DNS lookups), or an admin
 *                  verified them (employers.verification_tier = 'verified')
 */

export type EmployerTier = "basic" | "email_verified" | "verified";

const TIER_RANK: Record<EmployerTier, number> = { basic: 0, email_verified: 1, verified: 2 };

export const TIER_LIMITS: Record<EmployerTier, { unlocksPerDay: number; openRequirements: number; rematchesPerHour: number }> = {
  basic: { unlocksPerDay: 3, openRequirements: 3, rematchesPerHour: 5 },
  email_verified: { unlocksPerDay: 25, openRequirements: 15, rematchesPerHour: 20 },
  verified: { unlocksPerDay: 100, openRequirements: 50, rematchesPerHour: 40 },
};

/* Single shared list: the server (work_email_required gate, tier derivation)
 * and the onboarding pre-check both read it, so they can never disagree.
 * Exported so tests can assert every entry is rejected. */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.in", "yahoo.co.in", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca", "yahoo.com.au", "yahoo.com.br", "yahoo.com.sg",
  "yahoo.com.ph", "yahoo.com.hk", "yahoo.com.mx", "yahoo.com.ar", "yahoo.co.jp", "yahoo.co.id", "yahoo.co.nz", "yahoo.ie",
  "outlook.com", "outlook.in", "outlook.co.uk", "outlook.com.au", "outlook.fr", "outlook.de",
  "hotmail.com", "hotmail.co.in", "hotmail.in", "hotmail.co.uk", "hotmail.com.au", "hotmail.fr", "hotmail.de",
  "live.com", "live.in", "live.co.uk", "live.com.au", "live.fr", "live.de", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tutamail.com", "tuta.io",
  "rediff.com", "rediffmail.com", "sify.com", "bol-online.in", "in.com", "airtel.in",
  "hey.com", "duck.com", "web.de", "mail.ru", "qq.com", "163.com", "126.com",
  "zoho.com", "zohomail.in", "zohomail.com", "yandex.com", "yandex.ru",
  "mail.com", "gmx.com", "gmx.net", "inbox.com", "fastmail.com",
  "indiatimes.com", "yahoomail.com", "lycos.com", "aim.com", "att.net", "comcast.net", "verizon.net", "sbcglobal.net",
  "bellsouth.net", "cox.net", "earthlink.net", "optonline.net", "libero.it", "orange.fr", "free.fr", "wanadoo.fr",
  "t-online.de", "gmx.de", "freenet.de", "naver.com", "daum.net", "hanmail.net", "sina.com", "sohu.com", "yeah.net",
  "rambler.ru", "bk.ru", "list.ru", "inbox.ru", "ukr.net", "abv.bg", "o2.pl", "wp.pl", "interia.pl", "seznam.cz",
  "mailfence.com", "runbox.com", "posteo.de", "mailbox.org", "hushmail.com", "gmx.us", "rediffmail.in", "rediff.co.in",
]);

/* Throwaway inboxes: never a real company contact, whatever the website says. */
export const DISPOSABLE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  // Mailinator family
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com", "mailinater.com", "notmailinator.com", "tmailinator.com",
  "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com", "letthemeatspam.com", "reallymymail.com", "reconmail.com",
  "safetymail.info", "sogetthis.com", "spamhereplease.com", "streetwisemail.com", "suremail.info", "thisisnotmyrealemail.com",
  "tradermail.info", "veryrealemail.com", "zippymail.info",
  // Guerrilla Mail family
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info",
  "guerrillamailblock.com", "sharklasers.com", "grr.la", "spam4.me", "pokemail.net",
  // 10-minute / temp-mail style
  "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.co.uk", "10minemail.com", "20minutemail.com",
  "30minutemail.com", "my10minutemail.com", "tempmail.com", "tempmail.net", "temp-mail.org", "temp-mail.io", "temp-mail.ru",
  "tempr.email", "tempmailo.com", "tempail.com", "tempinbox.com", "tempmailaddress.com", "tmpmail.org", "tmpmail.net",
  "tmail.ws", "temporary-mail.net", "temporaryemail.net", "temporaryforwarding.com", "temporaryinbox.com", "tempsky.com",
  "tmailor.com", "throwam.com", "burnermail.io",
  // Yopmail family
  "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj",
  "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  // Trashmail / wegwerf / discard
  "trashmail.com", "trashmail.net", "trashmail.org", "trashmail.de", "trashmail.me", "trashmail.io", "trashmail.at",
  "trash-mail.com", "trash-mail.de", "trashymail.com", "mytrashmail.com", "mailmetrash.com", "easytrashmail.com",
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org", "wegwerfemail.de", "einrot.com", "einrot.de",
  "discard.email", "discardmail.com", "discardmail.de", "dropmail.me", "33mail.com",
  // Fake Mail Generator and other generators
  "armyspy.com", "cuvox.de", "dayrep.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
  "emailfake.com", "email-fake.com", "fakemail.net", "fakemailgenerator.com", "fakeinbox.com", "getairmail.com",
  "getnada.com", "nada.email", "maildrop.cc", "throwawaymail.com", "dispostable.com", "mailnesia.com", "mohmal.com",
  "emailondeck.com", "harakirimail.com", "incognitomail.org", "inboxbear.com", "inboxkitten.com", "moakt.com", "moakt.cc",
  "mailsac.com", "mailcatch.com", "mailexpire.com", "mailforspam.com", "mailmoat.com", "mailnull.com", "mailtemp.info",
  "mailzilla.com", "maildim.com", "emailtemporanea.net", "crazymailing.com", "cs.email",
  // Spam-trap style
  "anonbox.net", "anonymbox.com", "spamgourmet.com", "spamex.com", "spambox.us", "spamfree24.org", "spamavert.com",
  "spam.la", "spaml.com", "spambog.com", "spambog.de", "spambog.ru", "sendspamhere.com", "putthisinyourspamdatabase.com",
  "nospamfor.us", "nospam4.us", "nurfuerspam.de", "haltospam.com", "spoofmail.de", "smellfear.com", "snakemail.com",
  "sneakemail.com", "spamevader.com",
  // Assorted well-known throwaway providers
  "mintemail.com", "mt2014.com", "nowmymail.com", "objectmail.com", "onewaymail.com", "owlpic.com", "pjjkp.com", "quickinbox.com",
  "rcpt.at", "s0ny.net", "shieldedmail.com", "sofort-mail.de", "jetable.org", "kasmail.com", "klassmaster.com", "lroid.com",
  "mvrht.com", "mypartyclip.de", "nepwk.com", "nwldx.com", "oneoffmail.com", "pookmail.com", "proxymail.eu", "receiveee.com",
  "rmqkr.net", "selfdestructingmail.com", "trbvm.com", "trbvn.com", "wh4f.org", "yuurok.com", "dcctb.com", "deadaddress.com",
  "disposableemailaddresses.com", "e4ward.com", "emkei.cz", "fastacura.com", "filzmail.com", "getonemail.com", "hulapla.de",
  "imails.info", "instant-mail.de", "jnxjn.com", "junk1e.com", "kurzepost.de", "lifebyfood.com", "lookugly.com", "meltmail.com",
  "nobulk.com", "noclickemail.com", "nomail.pw", "pancakemail.com", "plexolan.de", "privatdemail.net", "quickmail.nl",
  "rppkn.com", "sandelf.de", "stuffmail.de", "supergreatmail.com", "teewars.org", "thankyou2010.com", "tyldd.com",
  "uggsrock.com", "vomoto.com", "walala.org", "webm4il.info", "wilemail.com", "xagloo.com", "yapped.net", "zehnminutenmail.de",
  "zoemail.org",
]);

export function emailDomain(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableMailDomain(domain: string): boolean {
  return DISPOSABLE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}

/** True for free-mail and disposable providers alike: neither proves a company. */
export function isFreeMailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return FREE_MAIL_DOMAINS.has(d) || DISPOSABLE_MAIL_DOMAINS.has(d);
}

/** Registrable-ish host of a website string ("https://www.acme.co.in/x" -> "acme.co.in"). */
export function websiteHost(website: string | null | undefined): string {
  if (!website || typeof website !== "string") return "";
  const raw = website.trim();
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* Built-in public-suffix subset (no network, no dependency). A website or email
 * domain that IS one of these, or that sits under a multi-label suffix here, is
 * resolved to its registrable domain so "acme.co.in" is never confused with the
 * shared suffix "co.in". Unknown TLDs fall back to a single-label suffix, which
 * is correct for every plain gTLD/ccTLD not listed. Private hosting suffixes
 * (github.io, vercel.app ...) are included because anyone can register a
 * subdomain there, so owning "x.vercel.app" proves nothing about a company. */
export const PUBLIC_SUFFIXES: ReadonlySet<string> = new Set([
  // India
  "co.in", "org.in", "net.in", "ac.in", "gov.in", "nic.in", "edu.in", "res.in", "firm.in", "gen.in", "ind.in", "mil.in",
  // UK / Ireland
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk",
  // APAC / other common
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "co.nz", "org.nz", "net.nz", "co.za", "org.za", "com.sg", "edu.sg", "org.sg",
  "com.my", "com.ph", "com.hk", "com.tw", "com.cn", "net.cn", "org.cn", "co.jp", "or.jp", "ne.jp", "co.kr", "co.id", "or.id",
  "com.pk", "com.bd", "com.lk", "com.np", "co.th", "com.vn",
  "com.br", "com.ar", "com.mx", "com.co", "com.tr", "com.ng", "co.ke", "com.eg", "co.il", "com.ua", "com.pl",
  "co.ae", "com.sa", "com.qa",
  // Private suffixes where subdomains are open to anyone
  "github.io", "gitlab.io", "vercel.app", "netlify.app", "herokuapp.com", "blogspot.com", "wordpress.com", "web.app",
  "firebaseapp.com", "pages.dev", "workers.dev", "onrender.com", "azurewebsites.net", "cloudfront.net", "amazonaws.com",
  "appspot.com", "wixsite.com", "weebly.com", "squarespace.com", "notion.site", "carrd.co", "framer.app", "my.canva.site",
]);

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, "").replace(/^www\./, "");
}

/** True when the host is exactly a public suffix ("co.in", "com", "vercel.app"). */
export function isPublicSuffixHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  return !h.includes(".") || PUBLIC_SUFFIXES.has(h);
}

/** Registrable domain ("mail.acme.co.in" -> "acme.co.in"), or "" when the host
 *  is empty, an IP-like literal, or itself a public suffix. */
export function registrableDomain(host: string | null | undefined): string {
  const h = normalizeHost(host ?? "");
  if (!h || isPublicSuffixHost(h)) return "";
  const labels = h.split(".");
  if (!/[a-z]/.test(labels[labels.length - 1])) return ""; // IPv4 / numeric TLD
  // Longest multi-label suffix wins; otherwise the last label is the suffix.
  let suffixLabels = 1;
  for (let n = Math.min(3, labels.length - 1); n >= 2; n--) {
    if (PUBLIC_SUFFIXES.has(labels.slice(-n).join("."))) { suffixLabels = n; break; }
  }
  return labels.slice(-(suffixLabels + 1)).join(".");
}

/** A website we accept on a company profile: has a real host that is not a
 *  public suffix or IP. Free-mail hosts are rejected by the tier rule, not here. */
export function isAcceptableCompanyWebsite(website: string | null | undefined): boolean {
  return registrableDomain(websiteHost(website)) !== "";
}

export function isEmployerTier(v: unknown): v is EmployerTier {
  return v === "basic" || v === "email_verified" || v === "verified";
}

/** Effective tier = the higher of the stored tier (admin/grandfathered) and what
 *  the confirmed sign-in email + website prove right now. Never lowers a stored tier. */
export function deriveEmployerTier(input: {
  storedTier: unknown;
  email: string | null | undefined;
  emailConfirmed: boolean;
  website: string | null | undefined;
}): EmployerTier {
  const stored: EmployerTier = isEmployerTier(input.storedTier) ? input.storedTier : "basic";
  let derived: EmployerTier = "basic";
  const domain = emailDomain(input.email);
  if (input.emailConfirmed && domain && !isFreeMailDomain(domain)) {
    derived = "email_verified";
    // Exact registrable-domain match only: suffix matching let "x@acme.co.in" verify
    // against a website of "co.in", and a lookalike "evilacme.com" must never match "acme.com".
    // Purely string-based on purpose: no DNS in the request path.
    const mailRoot = registrableDomain(domain);
    const siteRoot = registrableDomain(websiteHost(input.website));
    if (mailRoot && siteRoot && mailRoot === siteRoot && !isFreeMailDomain(siteRoot)) {
      derived = "verified";
    }
  }
  return TIER_RANK[derived] > TIER_RANK[stored] ? derived : stored;
}

export function tierAtLeast(tier: EmployerTier, min: EmployerTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

/** A suspended employer (admin action or 3+ independent candidate reports)
 *  keeps read access to their own data but cannot message, unlock or rematch. */
export function isSuspended(employer: { suspended_at?: string | null } | null | undefined): boolean {
  return !!employer?.suspended_at;
}

/** employers.suspended_reason stamped by delete-account on a soft delete. A soft-deleted
 *  employer reuses the suspension gate (every read/write/unlock/message path already
 *  enforces suspended_at), and this marker is how restore lifts ONLY its own block
 *  without un-suspending an account an admin or the report threshold suspended. */
export const DELETION_PENDING_REASON = "account_deletion_pending";

export function isDeletionPending(employer: { suspended_at?: string | null; suspended_reason?: string | null } | null | undefined): boolean {
  return !!employer?.suspended_at && employer.suspended_reason === DELETION_PENDING_REASON;
}

export const AUTO_SUSPEND_REPORT_THRESHOLD = 3;

/** True when this many independent candidates have reported the employer. */
export function shouldAutoSuspend(distinctReporters: number): boolean {
  return distinctReporters >= AUTO_SUSPEND_REPORT_THRESHOLD;
}

/** Whole-word masked name shown to employers before unlock — single source so
 *  messages, evidence and the requirement detail never diverge. */
export function maskedCandidateName(matchId: string): string {
  return `Candidate #${matchId.slice(0, 6)}`;
}
