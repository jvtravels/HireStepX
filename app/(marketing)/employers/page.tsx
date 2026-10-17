import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { editorialCSS, DarkBand, ctaPrimaryStyle } from "@/marketing-v2/_editorial";
import { formatPaise, UNLOCK_BATCH_PRICE_PAISE, UNLOCK_BUNDLE_SIZE, UNLOCK_SINGLE_PRICE_PAISE } from "../../../server-handlers/_unlock-pricing";
import {
  CREDIT_BACK_SENTENCE,
  GST_STATEMENT,
  HIDDEN_BEFORE_UNLOCK,
  PAY_AS_YOU_GO_SENTENCE,
  REVEALED_ON_UNLOCK,
  VISIBLE_BEFORE_UNLOCK,
  proratedRemainderSentence,
} from "@/employer/_employerOffer";
import { FAQ_ENTRIES, SCORING_STEPS } from "./_content";
import { buildEmployersJsonLd } from "./_jsonld";
import { employersCSS } from "./_styles";

const PRICE_LINE = `${formatPaise(UNLOCK_BATCH_PRICE_PAISE)} for ${UNLOCK_BUNDLE_SIZE} candidates or ${formatPaise(UNLOCK_SINGLE_PRICE_PAISE)} for one`;
const TITLE = "Post a job and hire candidates matched on interview practice";
const DESCRIPTION = `Post a job free and get an AI-matched shortlist of candidates who practise interviews on HireStepX, ranked on skills fit and, where they have them, their own graded practice sessions. Pay only to unlock contact details: ${PRICE_LINE}. No subscription.`;
const SHARE_IMAGE = "https://hirestepx.com/opengraph-image";

/* Reuses the site-wide share card (/opengraph-image); a per-route card would
   collide with the root convention, see questions/[slug]/opengraph-image.tsx. */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/employers" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://hirestepx.com/employers",
    type: "website",
    siteName: "HireStepX",
    locale: "en_IN",
    images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: "HireStepX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

const bar = (pct: number): CSSProperties => ({ width: `${pct}%` });

const SAMPLE_BARS: ReadonlyArray<{ label: string; pct: number }> = [
  { label: "Role", pct: 90 },
  { label: "Skills", pct: 78 },
  { label: "Location", pct: 100 },
];

const VALUE_CARDS: ReadonlyArray<{ title: string; body: string }> = [
  { title: "AI-matched, not keyword-matched", body: "Candidates are ranked on how well their role and skills fit your job, plus, where they have completed practice sessions, the results: STAR structure, answer depth and readiness." },
  { title: "Pay only to unlock a contact", body: `Browse match scores, skill breakdowns, practice evidence and resume detail for free. Unlock a batch of ${UNLOCK_BUNDLE_SIZE} for ${formatPaise(UNLOCK_BATCH_PRICE_PAISE)}, or one candidate for ${formatPaise(UNLOCK_SINGLE_PRICE_PAISE)}. Pay as you go, no subscription.` },
  { title: "Fair to candidates too", body: "Candidates control whether employers can discover them, and can block or report an employer. Until you unlock a candidate you see their resume and practice evidence under \"Candidate #…\", without their name, contact details or links. Employers self-serve sign up and are placed in verification tiers." },
];

export default function EmployersLandingPage() {
  return (
    <>
      <style>{editorialCSS}</style>
      <style>{employersCSS}</style>
      {buildEmployersJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <NavV2 />
      <div className="emp-page">
        <section className="emp-hero">
          <div className="emp-eyebrow">For employers</div>
          <h1 className="emp-h1">Hire candidates who practise how they interview</h1>
          <p className="emp-lede">
            Post a job. We match it against candidates who practise on HireStepX and hand you a shortlist ranked on
            skills fit and, where they have completed them, their own graded practice sessions, not just keywords on a resume.
          </p>
          <div className="emp-actions">
            <Link href="/signup?next=/employer" className="emp-btn emp-btn-primary">Post a job, free</Link>
            <Link href="/login?next=/employer" className="emp-btn emp-btn-ghost">Sign in</Link>
          </div>
          <p className="emp-fine">
            Free to post and free to browse your shortlist. Pay only when you unlock a candidate's contact details. See the{" "}
            <Link href="/terms#employers" className="emp-link">employer terms</Link> and{" "}
            <Link href="/refund#employers" className="emp-link">refund policy</Link>.
          </p>
        </section>

        <section className="emp-wrap" aria-labelledby="emp-why">
          <h2 className="emp-h2" id="emp-why">Why post a job on HireStepX</h2>
          <p className="emp-sub">A ranked shortlist you can judge for free, and a fee only when you reach a person.</p>
          <div className="emp-grid3">
            {VALUE_CARDS.map((c) => (
              <div key={c.title} className="emp-card">
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="emp-wrap" aria-labelledby="emp-locked">
          <h2 className="emp-h2" id="emp-locked">What you see before and after you unlock</h2>
          <p className="emp-sub">Everything that helps you judge fit is visible for free. You pay only to reach the person.</p>
          <div className="emp-grid2">
            <div className="emp-split">
              <div className="emp-card">
                <h3 className="emp-h3">Free, before unlocking</h3>
                <ul className="emp-list">{VISIBLE_BEFORE_UNLOCK.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="emp-card">
                <h3 className="emp-h3">Hidden until you unlock</h3>
                <ul className="emp-list emp-list-locked">{HIDDEN_BEFORE_UNLOCK.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="emp-card">
                <h3 className="emp-h3">Unlocking adds</h3>
                <ul className="emp-list">{REVEALED_ON_UNLOCK.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            </div>
            <aside className="emp-sample" aria-label="Example candidate card">
              <span className="emp-badge">Example</span>
              <p className="emp-sample-note">Illustration with placeholder data. Not a real candidate.</p>
              <div className="emp-sample-head">
                <div>
                  <div className="emp-sample-name">Candidate #7Q4K2M</div>
                  <div className="emp-sample-role">Backend Developer · Pune</div>
                </div>
                <div className="emp-score">82<small>match score</small></div>
              </div>
              <div className="emp-bars">
                {SAMPLE_BARS.map((b) => (
                  <div key={b.label} className="emp-bar">
                    <span>{b.label}</span>
                    <span className="emp-bar-track"><span className="emp-bar-fill" style={bar(b.pct)} /></span>
                    <span>{b.pct}</span>
                  </div>
                ))}
              </div>
              <ul className="emp-chips" aria-label="Skills">
                <li>Node.js</li><li>PostgreSQL</li><li>REST APIs</li><li>Docker</li>
              </ul>
              <p className="emp-quote">"On my last project I cut API response time by moving the slowest queries behind a cache, then measured the result…"</p>
              <div className="emp-locked-row"><span>Practice sessions</span><b>3 completed · Readiness: Hire</b></div>
              <div className="emp-locked-row"><span>Name</span><b>Hidden until unlocked</b></div>
              <div className="emp-locked-row"><span>Email, phone, LinkedIn</span><b>Hidden until unlocked</b></div>
            </aside>
          </div>
        </section>

        <section className="emp-wrap" aria-labelledby="emp-scoring">
          <h2 className="emp-h2" id="emp-scoring">How a match is scored</h2>
          <p className="emp-sub">A 0 to 100 score from three steps. Each step is something we compute, not a promise about the hire.</p>
          <ol className="emp-steps">
            {SCORING_STEPS.map((s) => (
              <li key={s.title} className="emp-step">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="emp-caveat">
            Practice scores come from candidates' own sessions on HireStepX. They are not independent or proctored assessments
            and do not guarantee a hire.
          </p>
        </section>

        <section className="emp-wrap" aria-labelledby="emp-billing">
          <h2 className="emp-h2" id="emp-billing">How billing works</h2>
          <p className="emp-sub">{PAY_AS_YOU_GO_SENTENCE}</p>
          <div className="emp-grid2">
            <div className="emp-card">
              <h3>Batch of {UNLOCK_BUNDLE_SIZE}</h3>
              <div className="emp-price">{formatPaise(UNLOCK_BATCH_PRICE_PAISE)} <small>for {UNLOCK_BUNDLE_SIZE} candidates</small></div>
              <p>Unlock the next {UNLOCK_BUNDLE_SIZE} candidates in your ranked shortlist in one payment.</p>
            </div>
            <div className="emp-card">
              <h3>Single candidate</h3>
              <div className="emp-price">{formatPaise(UNLOCK_SINGLE_PRICE_PAISE)} <small>per candidate</small></div>
              <p>Unlock just one profile when you only need that person.</p>
            </div>
          </div>
          <div className="emp-billing">
            <p><strong>Partial batches.</strong> {proratedRemainderSentence()}</p>
            <p><strong>Credit back.</strong> {CREDIT_BACK_SENTENCE}</p>
            <p><strong>GST.</strong> {GST_STATEMENT}</p>
            <p>
              Full details in the <Link href="/terms#employers" className="emp-link">employer terms</Link> and the{" "}
              <Link href="/refund#employers" className="emp-link">refund policy</Link>.
            </p>
          </div>
        </section>

        <section className="emp-wrap" aria-labelledby="emp-faq">
          <h2 className="emp-h2" id="emp-faq">Questions employers ask</h2>
          <div className="emp-faq">
            {FAQ_ENTRIES.map((e) => (
              <details key={e.question}>
                <summary>{e.question}</summary>
                <p>{e.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <DarkBand eyebrow="Hiring, not hoping" title="Skip the resume pile," accent="hire on practice." videoSrc="/cta.mp4">
          <p className="emp-dark-copy">
            Candidates on HireStepX practise interviews, and completed sessions are graded by AI (self-run, not independent assessments). Post a job and see who matches.
          </p>
          <Link href="/signup?next=/employer" className="ed-cta" style={ctaPrimaryStyle("lg")}>
            Post a job, free <span className="ed-cta-arrow" aria-hidden>→</span>
          </Link>
        </DarkBand>
      </div>
      <FooterDome employer />
      <MobileStickyCTA employer />
    </>
  );
}
