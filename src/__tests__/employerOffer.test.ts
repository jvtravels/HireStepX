import { describe, it, expect } from "vitest";
import {
  CREDIT_BACK_SENTENCE,
  CREDIT_NO_RESPONSE_DAYS,
  CREDIT_ON_DELETION_SENTENCE,
  GST_SHORT_LINE,
  GST_STATEMENT,
  HIDDEN_BEFORE_UNLOCK,
  PAY_AS_YOU_GO_SENTENCE,
  REVEALED_ON_UNLOCK,
  VISIBLE_BEFORE_UNLOCK,
  proratedRemainderSentence,
  unlockFeeSentence,
  workedPricingExampleSentence,
} from "../employer/_employerOffer";
import { NO_RESPONSE_DAYS } from "../../server-handlers/_employer-credit";
import { UNLOCK_BATCH_PRICE_PAISE, UNLOCK_BUNDLE_SIZE, UNLOCK_SINGLE_PRICE_PAISE, formatPaise } from "../../server-handlers/_unlock-pricing";
import { FAQ_ENTRIES, SCORING_STEPS } from "../../app/(marketing)/employers/_content";
import { buildEmployersJsonLd } from "../../app/(marketing)/employers/_jsonld";

describe("employer offer copy", () => {
  it("stays in step with the server credit window", () => {
    expect(CREDIT_NO_RESPONSE_DAYS).toBe(NO_RESPONSE_DAYS);
    expect(CREDIT_BACK_SENTENCE).toContain(`${CREDIT_NO_RESPONSE_DAYS} days`);
  });

  it("derives prices from the pricing constants", () => {
    expect(unlockFeeSentence()).toContain(formatPaise(UNLOCK_BATCH_PRICE_PAISE));
    expect(unlockFeeSentence()).toContain(`batches of ${UNLOCK_BUNDLE_SIZE}`);
    expect(proratedRemainderSentence()).toContain(`fewer than ${UNLOCK_BUNDLE_SIZE}`);
  });

  it("lists what unlocking reveals as exactly what is hidden before", () => {
    expect(HIDDEN_BEFORE_UNLOCK).toHaveLength(REVEALED_ON_UNLOCK.length);
    expect(VISIBLE_BEFORE_UNLOCK.join(" ")).not.toMatch(/portfolio/i);
  });

  it("says prices are GST-inclusive and never that GST is added on top", () => {
    expect(GST_STATEMENT).toMatch(/GST-inclusive/);
    expect(GST_STATEMENT).not.toMatch(/GST is added|added or included|plus GST/i);
  });

  it("keeps the short GST line in step with the full statement", () => {
    expect(GST_SHORT_LINE).toMatch(/total you pay/);
    expect(GST_SHORT_LINE).toMatch(/included/);
    expect(GST_SHORT_LINE).not.toMatch(/GST is added|plus GST|—/i);
  });

  it("builds the worked pricing example from the real price table", () => {
    const ex = workedPricingExampleSentence();
    expect(ex).toContain(`3 × ${formatPaise(UNLOCK_SINGLE_PRICE_PAISE)} = ${formatPaise(3 * UNLOCK_SINGLE_PRICE_PAISE)}`);
    expect(ex).toContain(formatPaise(UNLOCK_BATCH_PRICE_PAISE));
    expect(ex).toContain(formatPaise(UNLOCK_BUNDLE_SIZE * UNLOCK_SINGLE_PRICE_PAISE));
    expect(ex).not.toContain("—");
  });

  it("states credit forfeiture on deletion once, without em dashes or cash-out promises", () => {
    expect(CREDIT_ON_DELETION_SENTENCE).toMatch(/not redeemable for cash/);
    expect(CREDIT_ON_DELETION_SENTENCE).toMatch(/lapses when an account is deleted/);
    expect(CREDIT_ON_DELETION_SENTENCE).toMatch(/contact support before deleting/);
    expect(CREDIT_ON_DELETION_SENTENCE).not.toContain("—");
  });

  it("uses no em dashes in user-facing strings", () => {
    const all = [
      ...VISIBLE_BEFORE_UNLOCK, ...HIDDEN_BEFORE_UNLOCK, ...REVEALED_ON_UNLOCK,
      unlockFeeSentence(), proratedRemainderSentence(), PAY_AS_YOU_GO_SENTENCE, CREDIT_BACK_SENTENCE, GST_STATEMENT,
      ...SCORING_STEPS.flatMap((s) => [s.title, s.body]),
      ...FAQ_ENTRIES.flatMap((e) => [e.question, e.answer]),
    ];
    for (const s of all) expect(s).not.toContain("—");
  });
});

describe("/employers JSON-LD", () => {
  it("emits a breadcrumb and an FAQ with every entry", () => {
    const [crumb, faq] = buildEmployersJsonLd();
    expect(JSON.parse(crumb.__html)["@type"]).toBe("BreadcrumbList");
    const parsed = JSON.parse(faq.__html);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(FAQ_ENTRIES.length);
  });

  it("also emits an Organization for the brand", () => {
    const org = buildEmployersJsonLd().map((s) => JSON.parse(s.__html)).find((o) => o["@type"] === "Organization");
    expect(org).toMatchObject({ name: "HireStepX", url: "https://hirestepx.com" });
  });

  it("never emits a raw < in the serialised payload", () => {
    for (const { __html } of buildEmployersJsonLd()) expect(__html).not.toContain("<");
  });
});
