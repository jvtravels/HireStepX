/* Single source of truth for the versions of the legal documents a user can
   consent to. Bump the date when the Terms / Privacy Policy change in a way
   that needs fresh consent: signup records the version accepted
   (user_consents.version) and the cookie banner re-asks when
   COOKIE_CONSENT_VERSION changes. */
export const TERMS_VERSION = "2026-10-11";
export const PRIVACY_VERSION = "2026-10-11";

/** What user_consents.version stores for the signup affirmation (18+, Terms,
 *  Privacy, and the employer-discovery notice shown next to it): one string so
 *  a change to any of the documents or that wording is a new consent version. */
export const TERMS_PRIVACY_CONSENT_VERSION =
  TERMS_VERSION === PRIVACY_VERSION ? TERMS_VERSION : `${TERMS_VERSION}+${PRIVACY_VERSION}`;

/** Version of the cookie categories/wording shown in the banner. */
export const COOKIE_CONSENT_VERSION = "2026-10-11";

/** user_consents.purpose for the signup "18+ and agree to Terms/Privacy" affirmation. */
export const TERMS_PRIVACY_PURPOSE = "terms_privacy";
