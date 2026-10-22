/* HireStepX — Disposable / throwaway-email blocklist (server side)

   This is the SERVER-side enforcement of the same blocklist that lives
   on the client at src/auth/_validation.ts (isDisposableEmail). The
   client check is UX (fast feedback in the form); this one is the
   actual gate — a curl past the client form can't bypass it.

   Keep the two lists in sync. They're short and stable; the easiest
   path is to copy on change. We don't share a single source between
   src/ and server-handlers/ to avoid widening the import boundary —
   the server runs Edge / Node, the client runs in the browser, and
   bundling their shared dependencies has historically caused subtle
   issues. A 50-line denylist is cheap to duplicate. */

export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // 10-minute / timed-expiry services
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "30minutemail.com",
  "zehnminutenmail.de",
  "tempinbox.com",
  "tempinbox.co.uk",
  "tempr.email",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "temp-mail.io",
  "temp-inbox.com",
  "tempmailaddress.com",
  "tempalias.com",
  "tempthe.net",
  "tempail.com",
  "mytemp.email",
  "easytrashmail.com",
  // Guerrilla Mail family
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  // Mailinator family
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailinator2.com",
  "tmailinator.com",
  // Yopmail family
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "yopmail.pp.ua",
  // Trashmail family
  "trashmail.com",
  "trashmail.de",
  "trashmail.net",
  "trashmail.me",
  "trashmail.io",
  "trashmail.at",
  "trashmail.org",
  "trashmailer.com",
  "trashemail.de",
  "trashimail.com",
  "trashbin.email",
  "trash-mail.at",
  "trash-mail.io",
  "mytrashmail.com",
  // Throwaway
  "throwawaymail.com",
  "throwaway.email",
  "throwam.com",
  // Fake / disposable inbox
  "fakeinbox.com",
  "emailfake.com",
  "email-fake.com",
  "instantemailaddress.com",
  "incognitomail.com",
  "incognitomail.net",
  "incognitomail.org",
  // Get / Nada / Drop
  "getairmail.com",
  "getnada.com",
  "maildrop.cc",
  // Mail* misc
  "mailnesia.com",
  "mailnull.com",
  "mailsac.com",
  "mailscrap.com",
  "mailtemp.info",
  "mailtemporaire.fr",
  "mailtome.de",
  "mailtothis.com",
  "mailezee.com",
  "mailme24.com",
  "maileimer.de",
  "mailbidon.com",
  // Moakt / Mohmal
  "moakt.com",
  "mohmal.com",
  // MT series
  "mt2014.com",
  "mt2015.com",
  // Discard / Dispostable
  "dispostable.com",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "disposableaddress.com",
  "dispose.it",
  // Spamgourmet family
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "spambox.us",
  "spamobox.com",
  "spam.la",
  "spam4.me",
  "spaml.com",
  "spamspot.com",
  "spamfree.eu",
  // Wegwerf (German disposable)
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  // Jetable (French disposable)
  "jetable.com",
  "jetable.net",
  "jetable.org",
  // Misc high-abuse domains
  "mintemail.com",
  "harakirimail.com",
  "inboxbear.com",
  "burnermail.io",
  "anonbox.net",
  "anonaddy.me",
  "instaaddr.com",
  "tmpmail.org",
  "tmpmail.net",
  "trbvm.com",
  "nwytg.net",
  "kukumail.com",
  "dodgit.com",
  "dumpmail.de",
  "despam.it",
  "tmail.io",
  "killmail.com",
  "killmail.net",
  "kasmail.com",
  "filzmail.de",
  "mailnull.com",
]);

/** Returns true if the email's domain is on the disposable / throwaway
    provider list. Matches the domain exactly (no substring). Lowercases
    + trims defensively so callers can pass raw input. */
export function isDisposableEmailServer(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const at = value.lastIndexOf("@");
  if (at < 0) return false;
  const domain = value.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/* ─── Server-side password policy (parity with client) ───
   Mirrors src/auth/_validation.ts validateSignupPassword exactly so a
   curl past the form can't land a weak password. The client validator
   produces friendlier error copy + a strength meter; this one returns
   a single boolean error message suitable for an API response. */

export interface PasswordPolicyResult {
  ok: boolean;
  /** User-facing reason on failure. Null when ok=true. */
  error: string | null;
}

export function validatePasswordServer(password: string): PasswordPolicyResult {
  if (typeof password !== "string") {
    return { ok: false, error: "Password is required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password.length > 128) {
    return { ok: false, error: "Password must be 128 characters or fewer." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: "Password must include an uppercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: "Password must include a number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: "Password must include a special character." };
  }
  return { ok: true, error: null };
}
