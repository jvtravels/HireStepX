import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { PrivacyV2, TermsV2, RefundPolicyV2, HowItWorksV2 } from "../marketing-v2/MarketingPagesV2";
import EmployersLandingPage, { metadata } from "../../app/(marketing)/employers/page";
import { FAQ_ENTRIES, SCORING_STEPS } from "../../app/(marketing)/employers/_content";
import { FooterDome } from "../marketing-v2/FooterDome";

vi.mock("next/navigation", () => ({
  usePathname: () => "/employers",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/* The nav needs AuthProvider; its links are not what these tests guard. */
vi.mock("../marketing-v2/HomepageV2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../marketing-v2/HomepageV2")>()),
  NavV2: () => null,
  MobileStickyCTA: () => null,
}));

function dom(el: ReactElement): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(el);
  // CSS comments are not user-facing copy.
  root.querySelectorAll("style").forEach((n) => n.remove());
  return root;
}

function headingLevels(root: ParentNode): number[] {
  return Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => Number(h.tagName[1]));
}

describe("/employers copy", () => {
  const container = dom(<EmployersLandingPage />);
  const text = container.textContent ?? "";

  it("has no em dashes in the page, metadata or FAQ", () => {
    const meta = JSON.stringify(metadata);
    const content = [...SCORING_STEPS.flatMap((s) => [s.title, s.body]), ...FAQ_ENTRIES.flatMap((e) => [e.question, e.answer])].join(" ");
    for (const s of [text, meta, content]) {
      expect(s).not.toContain("—");
      expect(s).not.toContain("&mdash;");
    }
  });

  it("does not call practice sessions verified", () => {
    expect(text).not.toMatch(/verified practice sessions/i);
    expect(SCORING_STEPS.map((s) => s.title)).toContain("Graded practice sessions");
  });

  it("does not claim every candidate has already proven how they interview", () => {
    expect(text).not.toMatch(/already proven|hire on proof/i);
    expect(JSON.stringify(metadata)).not.toMatch(/already proven/i);
  });

  it("keeps the heading outline in order (h1, then h2, then h3) with no candidate-addressed footer heading", () => {
    const levels = headingLevels(container);
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    expect(text).not.toContain("You've done the work");
  });
});

describe("FooterDome", () => {
  it("keeps the candidate headline on candidate pages and drops it on the employer page", () => {
    const candidate = dom(<FooterDome />);
    expect(candidate.querySelector("h2")?.textContent).toContain("You've done the work");
    const employer = dom(<FooterDome employer />);
    expect(employer.querySelector("h2")).toBeNull();
  });
});

describe("candidate-facing employer visibility copy", () => {
  const pages = { privacy: dom(<PrivacyV2 />).textContent ?? "", terms: dom(<TermsV2 />).textContent ?? "", refund: dom(<RefundPolicyV2 />).textContent ?? "", howItWorks: dom(<HowItWorksV2 />).textContent ?? "" };

  it("never says employers or schools are removed from the pre-unlock resume", () => {
    for (const [name, t] of Object.entries(pages)) {
      expect(t, name).not.toMatch(/past employers and schools removed/i);
      expect(t, name).not.toMatch(/(employers|schools)[^.]{0,40}\bremoved/i);
    }
    expect(pages.howItWorks).toContain("including past employers, schools and city");
    expect(pages.privacy).toContain("including past employers, schools and your city");
  });

  it("does not say unlocking releases the resume or excerpts that are already visible", () => {
    expect(pages.privacy).not.toMatch(/Unlocking releases your name, email, phone, LinkedIn, your resume/);
    expect(pages.privacy).toMatch(/Unlocking releases your name, email, phone, LinkedIn, portfolio links and the original resume file/);
  });

  it("has no em dashes in the privacy, terms or refund pages", () => {
    for (const k of ["privacy", "terms", "refund"] as const) expect(pages[k], k).not.toContain("—");
  });
});
