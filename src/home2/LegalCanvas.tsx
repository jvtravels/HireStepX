"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Shell } from "./Pages";
import { CopyEmailLink } from "../_CopyEmailLink";
import { LEGAL_META } from "./legalDocs";
import { openCookieSettings } from "../consent";


function PrivacyBody() {
  return (
    <>
      <h2>What we collect</h2>
      <p>Account email, your resume (uploaded by you), transcripts of your mock sessions, and basic usage telemetry (page views, session counts, plan type). We do not store audio or video recordings of your sessions: if you answer by voice, your speech is streamed to our speech-to-text provider for live transcription and is not retained. No location, no contacts, no microphone access outside of an active interview round.</p>

      <h2>Why we collect it</h2>
      <p>To run the product. The resume tunes the AI's questions to your background. The transcripts power scoring and the report you read after each session. Email is for login, receipts, and support replies.</p>

      <h2>How long we keep it</h2>
      <p>Transcripts auto-delete after 90 days unless you explicitly save a session. Account data persists until you delete your account, after which it's purged within 30 days.</p>

      <h2>Who we share with</h2>
      <p>We do not sell your data, and we do not share your transcripts, scores, or resume with colleges, advertisers, or other third parties. The one exception is employers on HireStepX, covered in the next section. We use the following third-party sub-processors, each under a data-processing agreement that prevents retention or use beyond what we authorise:</p>
      <ul>
        <li><strong>Supabase</strong>: database, authentication, and file storage (Ireland / US-East)</li>
        <li><strong>Vercel</strong>: serverless hosting and edge functions (global CDN)</li>
        <li><strong>Groq</strong>: primary AI inference for interview scoring and question generation (US)</li>
        <li><strong>Google (Gemini)</strong>: secondary AI inference fallback (US)</li>
        <li><strong>Deepgram</strong>: primary speech-to-text transcription of voice answers (US)</li>
        <li><strong>Sarvam AI</strong>: Indian-English text-to-speech and speech-to-text fallback (India)</li>
        <li><strong>Cartesia</strong>: secondary text-to-speech (US)</li>
        <li><strong>Microsoft Azure</strong>: tertiary text-to-speech fallback (global)</li>
        <li><strong>Resend</strong>: transactional email delivery (US)</li>
        <li><strong>Razorpay</strong>: one-time payment processing (India)</li>
        <li><strong>PostHog</strong>: product analytics (US); only loaded after explicit cookie consent</li>
        <li><strong>Upstash</strong>: Redis-based rate limiting and caching (US)</li>
        <li><strong>Google AdSense</strong>: advertising on public blog, interview questions, and salary pages (US); may use cookies to serve relevant ads. You can opt out via <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ad Settings</a>.</li>
      </ul>
      <p>Voice audio is streamed live to Deepgram or Sarvam for real-time transcription and is not stored by either provider beyond the duration of the API call. We do not send your resume or session transcripts to Razorpay, Resend, PostHog, or Upstash. Google AdSense is only active on public content pages and is never loaded inside authenticated product surfaces (dashboard, interview sessions, reports).</p>

      <h2>Employer discovery</h2>
      <p><strong>Purpose.</strong> HireStepX also lets employers find candidates for open roles. If employer discovery is on for your account, employers can find you by role and skills using the evidence from your practice sessions. This is separate from practising: you can use HireStepX fully with it switched off.</p>
      <p><strong>What employers see before they unlock you.</strong> Your skill strengths and verified capabilities, readiness and answer-structure (STAR) indicators, a resume summary with your name, past employers, schools, phone and LinkedIn removed, your city, and when you last practised. They see you only as &ldquo;Candidate #&hellip;&rdquo;. Your scores come from your own practice sessions on HireStepX; they are not independently verified assessments.</p>
      <p><strong>What an employer gets by unlocking.</strong> An employer pays to unlock a candidate. Unlocking releases your name, contact details, full resume detail, and short word-for-word excerpts from your practice answers to that employer. Employers sign up on their own and have different verification levels; we do not vet every employer, so treat outreach with the same care as any job approach.</p>
      <p><strong>Your control and withdrawal.</strong> You can turn employer discovery off at any time in Settings &rarr; Employer visibility. You will stop appearing in employer searches and in matches no employer has unlocked yet. Withdrawing does not retroactively remove what an employer has already unlocked, but they cannot see anything new. We keep a record of when you gave and withdrew consent, which you can see in Settings. You can also block or report a specific employer from your Jobs or Messages screens; blocked employers can no longer see or contact you.</p>
      <p><strong>Retention.</strong> Employer discovery uses the same practice data described above, so it follows the same retention periods. Deleting your account removes you from employer discovery, and your data is purged within 30 days.</p>
      <p><strong>Questions or complaints.</strong> Contact our <a href="#grievance-officer">Grievance Officer</a>.</p>

      <h2 id="your-rights">Your rights under DPDP Act 2023</h2>
      <p>India's Digital Personal Data Protection Act, 2023 gives you the right to access, correct, and erase the data we hold on you, to nominate another person to exercise these rights on your behalf, and to a grievance redressal process. Lawful basis for processing is performance of contract (delivering the service you signed up for) for everything except optional analytics, which run on explicit consent only.</p>
      <p>Cross-border transfers: we process data within India and the United States, governed by standard contractual clauses with each sub-processor. If a grievance isn't resolved to your satisfaction, you may escalate to the Data Protection Board of India.</p>
      <p>We respond to any request within 7 business days. For data requests, complaints, or privacy questions, contact our <a href="#grievance-officer">Grievance Officer</a> at <CopyEmailLink email="hello@hirestepx.com" />.</p>

      <h2 id="cookies">Cookies</h2>
      <p><strong>Essential (always on).</strong> Your sign-in session and device token (stored in your browser's local storage), security and rate-limiting tokens, and a record of your cookie choice. The product cannot work without these.</p>
      <p><strong>Analytics (only after you opt in).</strong> PostHog, Google Analytics 4, and Vercel Analytics set identifiers to count visits and see which features are used. Vercel Speed Insights reports anonymised page-speed metrics without cookies.</p>
      <p><strong>Advertising (only after you opt in).</strong> On public content pages (blog, interview questions, salary guides), Google AdSense may set advertising cookies to show relevant ads. None are used on signed-in pages. You can opt out of personalised ads at any time via <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ad Settings</a> or by enabling "Do Not Track" in your browser.</p>
      <p>The banner lets you accept all optional cookies, reject all of them, or choose analytics and advertising separately. Nothing optional is switched on by default. To change or withdraw consent at any time, <button type="button" className="lg-linkbtn" onClick={openCookieSettings}>open cookie settings</button>. Withdrawing stops analytics and advertising from loading on your next page view.</p>

      <h2 id="grievance-officer">Grievance Officer</h2>
      <p>In line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023, HireStepX has a Grievance Officer for complaints from users.</p>
      <ul>
        <li><strong>Designation:</strong> Grievance Officer, HireStepX</li>
        <li><strong>Email:</strong> <CopyEmailLink email="hello@hirestepx.com" /></li>
      </ul>
      <p><strong>How to file.</strong> Email us with the subject line &ldquo;Grievance: [brief description]&rdquo;. Include your registered account email, a description of the issue, and any screenshots or order IDs.</p>
      <p><strong>Response times.</strong> We acknowledge within 24 hours and resolve within 15 days of acknowledgement, as the IT Rules 2021 require. Data requests (access, correction, erasure) are answered within 7 business days. Urgent safety concerns get a reply within 24 hours.</p>
      <p><strong>Content complaints.</strong> For unlawful content or misinformation under the IT Rules 2021, write to the same address. If your complaint is not resolved to your satisfaction within 30 days, you may escalate to the Data Protection Board of India under the DPDP Act 2023.</p>

      <h2>Children</h2>
      <p>HireStepX is not directed at users under 18. If you believe a minor has created an account, email us and we'll remove it.</p>

      <h2>Changes</h2>
      <p>We post updates here and, for material changes, email all account holders 14 days before they take effect. The diff between versions is published on this page.</p>
    
    </>
  );
}

function TermsBody() {
  return (
    <>
      <h2>Who can use HireStepX</h2>
      <p>Anyone 16 or older with a valid email address. By signing up, you confirm you are 16+ and the information you provide is accurate.</p>

      <h2>What you get</h2>
      <p>Access to the platform's mock interview features, scoring, reports, and content libraries based on the plan you select. Plans are described on <a href="/pricing">/pricing</a>.</p>

      <h2>What we expect</h2>
      <p>One account per person. Don't share login credentials. Don't scrape, reverse-engineer, or attempt to extract our scoring rubrics, question banks, or model outputs at scale. Don't use the platform to impersonate real candidates or train third-party AI systems.</p>

      <h2>Payment</h2>
      <p>Billed in INR via Razorpay. Per-session credits (₹9) are charged immediately and never expire. Sprint Pack (₹39 for 5 sessions) is a one-time purchase valid for 30 days, it does not auto-renew, and we never store your card for recurring billing. Buy another pack any time you want more sessions. No plan currently sold on HireStepX auto-renews.</p>

      <h2>Refunds</h2>
      <p>See our <a href="/refund">refund policy</a>. Short version: per-session credits and Sprint Pack purchases are both refundable within 7 days of purchase if unused.</p>

      <h2>Acceptable use</h2>
      <p>Don't upload illegal content. Don't use the platform to harass, defame, or harm others. Don't attempt to break our security controls. We may suspend or terminate accounts for serious or repeated violations.</p>

      <h2>Employer discovery</h2>
      <p>Employers on HireStepX can find candidates using practice evidence from sessions. Employers register themselves and are placed in verification tiers; we do not guarantee that any employer is vetted or that any job is genuine. Your name and contact details are released to an employer only after they unlock your profile, and you can turn discovery off, block, or report an employer from Settings, Jobs, or Messages. See the <a href="/privacy">Privacy Policy</a> for details. Practice scores reflect your performance in HireStepX sessions and are not a certified assessment.</p>

      <h2>Disclaimers</h2>
      <p>HireStepX provides interview practice. We do not guarantee any specific employment outcome. AI-generated feedback is a tool for self-improvement, not a substitute for professional career counseling.</p>

      <h2>Liability</h2>
      <p>To the maximum extent permitted by law, our total liability for any claim arising from your use of HireStepX is limited to the amount you paid us in the 12 months preceding the claim.</p>

      <h2>Cookies</h2>
      <p>We use essential cookies to keep you signed in, and analytics and advertising cookies only if you opt in. You can change your choice at any time, and the full list is in the <a href="/privacy#cookies">cookies section of the Privacy Policy</a>.</p>

      <h2>Complaints and grievances</h2>
      <p>If something goes wrong, write to our Grievance Officer at <CopyEmailLink email="hello@hirestepx.com" />. We acknowledge within 24 hours and resolve within 15 days. Contact details and the escalation route are in the <a href="/privacy#grievance-officer">Privacy Policy</a>.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Disputes go to the courts of Bengaluru, Karnataka.</p>
    
    </>
  );
}

function RefundBody() {
  return (
    <>
      <h2>Free plan</h2>
      <p>Nothing to refund; you didn't pay anything.</p>

      <h2>Per-session purchase (₹9)</h2>
      <p>Refundable up to 7 days after purchase, as long as the session hasn't started. Once you begin a session, the AI has done the work; the credit is consumed.</p>

      <h2>Sprint Pack (₹39 / 5 sessions)</h2>
      <p>A one-time purchase, valid for 30 days, it does not auto-renew, so there's no recurring charge to cancel. Full refund within 7 days of purchase if zero sessions have been used. After that, no refund for that pack; your remaining sessions stay active until the 30-day window ends. Want more sessions after that? Buy another pack any time.</p>

      <h2>How to request a refund</h2>
      <p>Email <CopyEmailLink email="hello@hirestepx.com" /> with your account email and order ID. We process refunds within 5 business days to the original payment method. Razorpay typically takes another 3–7 business days to reflect the credit on your bank statement.</p>

      <h2>Complaints</h2>
      <p>If a refund request is not resolved, write to our Grievance Officer at <CopyEmailLink email="hello@hirestepx.com" /> with the subject &ldquo;Grievance: refund&rdquo;. We acknowledge within 24 hours and resolve within 15 days. See the <a href="/privacy#grievance-officer">Privacy Policy</a> for the full process.</p>

      <h2>Disputes</h2>
      <p>If you believe a session was scored unfairly and want a refund of just that session's credit, hit the "Dispute score" link inside the session report. We review every dispute within 24 hours.</p>
    
    </>
  );
}

const BODIES: Record<string, () => ReactNode> = {
  privacy: PrivacyBody,
  terms: TermsBody,
  refund: RefundBody,
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function Toc({ proseRef }: { proseRef: React.RefObject<HTMLDivElement | null> }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    const next = Array.from(root.querySelectorAll("h2")).map((h) => {
      const text = h.textContent ?? "";
      if (!h.id) h.id = slugify(text);
      return { id: h.id, text };
    });
    setItems(next);
  }, [proseRef]);
  if (items.length < 2) return null;
  return (
    <nav className="lg-toc" aria-label="On this page">
      <h2>On this page</h2>
      {items.map((i) => <a key={i.id} href={`#${i.id}`}>{i.text}</a>)}
    </nav>
  );
}

export function LegalDocPage({ slug }: { slug: string }) {
  const doc = LEGAL_META.find((d) => d.slug === slug);
  const proseRef = useRef<HTMLDivElement>(null);
  if (!doc) return null;
  const Body = BODIES[slug];
  const others = LEGAL_META.filter((d) => d.slug !== slug);
  return (
    <Shell>
      <style>{legalCss}</style>
      <section className="lg-hero">
        <div className="hx-wrap">
          <a data-no-underline className="lg-back" href="/legal">All legal documents</a>
          <h1>{doc.title}</h1>
          <p className="lg-meta">Last updated {doc.updated}. Questions: <CopyEmailLink email="hello@hirestepx.com" />. Privacy or data complaints: <CopyEmailLink email="hello@hirestepx.com" />.</p>
        </div>
      </section>
      <section className="lg-body">
        <div className="hx-wrap lg-grid">
          <Toc proseRef={proseRef} />
          <article className="lg-prose" ref={proseRef}><Body /></article>
        </div>
      </section>
      <section className="lg-more">
        <div className="hx-wrap">
          <h2>More legal documents</h2>
          <div className="lg-list">
            {others.map((d) => <a key={d.slug} data-no-underline href={`/${d.slug}`}><b>{d.title}</b><span>{d.blurb}</span></a>)}
          </div>
        </div>
      </section>
    </Shell>
  );
}

export function LegalHubPage() {
  const groups = Array.from(new Set(LEGAL_META.map((d) => d.group)));
  return (
    <Shell>
      <style>{legalCss}</style>
      <section className="lg-hero">
        <div className="hx-wrap">
          <h1>Legal</h1>
          <p className="lg-meta">The rules, your rights and how we handle your data, in plain English. Questions: <CopyEmailLink email="hello@hirestepx.com" />.</p>
        </div>
      </section>
      <section className="lg-body">
        <div className="hx-wrap">
          {groups.map((g) => (
            <div key={g} className="lg-group">
              <h2>{g}</h2>
              <div className="lg-list">
                {LEGAL_META.filter((d) => d.group === g).map((d) => <a key={d.slug} data-no-underline href={`/${d.slug}`}><b>{d.title}</b><span>{d.blurb}</span><em>Updated {d.updated}</em></a>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

const legalCss = `
.lg-hero { padding: 72px 0 32px; border-bottom: 1px solid var(--line); background: var(--wash); }
.lg-hero h1 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; margin: 12px 0 0; text-wrap: balance; }
.lg-back { display: inline-block; font-size: 15px; color: var(--ink-2); }
.lg-back::before { content: '\\2190'; margin-right: 8px; }
.lg-back:hover { color: var(--ink); }
.lg-meta { margin: 16px 0 0; max-width: 64ch; font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.lg-meta a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.lg-body { padding: 48px 0 72px; }
.lg-grid { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 64px; align-items: start; }
.lg-toc { position: sticky; top: 96px; display: grid; gap: 4px; padding-right: 8px; }
.lg-toc h2 { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 8px; }
.lg-toc a { display: block; padding: 6px 0; font-size: 14px; line-height: 1.35; color: var(--ink-2); text-decoration: none; }
.lg-toc a:hover { color: var(--btn); }
.lg-prose { grid-column: 2; min-width: 0; max-width: 72ch; font-size: 17px; line-height: 1.7; color: var(--ink); }
.lg-prose > :first-child { margin-top: 0; }
.lg-prose h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 500; margin: 48px 0 12px; scroll-margin-top: 96px; }
.lg-prose p, .lg-prose ul { margin: 0 0 16px; }
.lg-prose ul { padding-left: 22px; display: grid; gap: 10px; }
.lg-prose li::marker { color: var(--ink-3); }
.lg-prose strong { font-weight: 600; }
.lg-prose em { font-style: normal; font-weight: 500; }
.lg-linkbtn { background: none; border: 0; padding: 0; font: inherit; color: var(--btn); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.lg-prose a { color: var(--btn); text-decoration: underline; text-underline-offset: 3px; }
.lg-tablewrap { overflow-x: auto; margin: 0 0 24px; border: 1px solid var(--line); border-radius: 14px; }
.lg-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 15px; line-height: 1.5; }
.lg-table th, .lg-table td { text-align: left; vertical-align: top; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.lg-table thead th { background: var(--wash); font-weight: 600; font-size: 13px; color: var(--ink-2); }
.lg-table tbody th { font-weight: 600; white-space: nowrap; }
.lg-table tbody tr:last-child th, .lg-table tbody tr:last-child td { border-bottom: 0; }
.lg-more { padding: 0 0 72px; }
.lg-more h2, .lg-group h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 24px; letter-spacing: -0.02em; font-weight: 500; margin: 0 0 16px; }
.lg-group { margin-bottom: 40px; }
.lg-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.lg-list a { display: grid; gap: 6px; align-content: start; padding: 22px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--white); color: var(--ink); transition: border-color .15s, box-shadow .15s; }
.lg-list a:hover { border-color: var(--btn); box-shadow: 0 8px 24px oklch(0.4 0.12 280 / 0.1); }
.lg-list b { font-size: 17px; font-weight: 600; }
.lg-list span { font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.lg-list em { font-style: normal; font-size: 13px; color: var(--ink-3); margin-top: 4px; }
@media (max-width: 900px) {
  .lg-hero { padding: 40px 0 24px; }
  .lg-hero h1 { font-size: 34px; }
  .lg-grid { grid-template-columns: 1fr; gap: 0; }
  .lg-toc { display: none; }
  .lg-prose { grid-column: 1; font-size: 16px; }
  .lg-prose h2 { font-size: 24px; margin-top: 36px; }
  .lg-list { grid-template-columns: 1fr; }
}
`;
