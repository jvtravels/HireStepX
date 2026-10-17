import { describe, it, expect } from "vitest";
import {
  CREDIT_BACK_SENTENCE,
  CREDIT_NO_RESPONSE_DAYS,
  GST_STATEMENT,
  HIDDEN_BEFORE_UNLOCK,
  PAY_AS_YOU_GO_SENTENCE,
  REVEALED_ON_UNLOCK,
  VISIBLE_BEFORE_UNLOCK,
  proratedRemainderSentence,
  unlockFeeSentence,
} from "../employer/_employerOffer";
import { NO_RESPONSE_DAYS } from "../../server-handlers/_employer-credit";
import { UNLOCK_BATCH_PRICE_PAISE, UNLOCK_BUNDLE_SIZE, formatPaise } from "../../server-handlers/_unlock-pricing";
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

  it("never emits a raw < in the serialised payload", () => {
    for (const { __html } of buildEmployersJsonLd()) expect(__html).not.toContain("<");
  });
});
