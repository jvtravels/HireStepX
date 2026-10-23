"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Shell } from "./Pages";
import { CopyEmailLink } from "../_CopyEmailLink";
import { CREDIT_ON_DELETION_SENTENCE } from "../employer/_employerOffer";
import { LEGAL_META } from "./legalDocs";
import type { Group } from "./legalDocs";
import {
  EmployerTermsList, GrievanceBody, PrivacyBody, RefundBody, TermsBody,
} from "../marketing-v2/MarketingPagesV2";


function CookiesBody() {
  return (
    <>
      <h2>What we use</h2>
      <p><strong>Essential (always on).</strong> Your sign-in session and device token (stored in your browser&apos;s local storage), security and rate-limiting tokens, and a record of your cookie choice. The product cannot work without these.</p>
      <p><strong>Analytics (only after you opt in).</strong> PostHog, Google Analytics 4, and Vercel Analytics set identifiers to count visits and see which features are used. Vercel Speed Insights reports anonymised page-speed metrics without cookies.</p>
      <p><strong>Advertising (only after you opt in).</strong> Google AdSense may set advertising cookies on public content pages (blog, interview questions, salary guides) to show relevant ads. None are used on signed-in pages.</p>

      <h2>Your choice</h2>
      <p>The banner lets you accept all optional cookies, reject all of them, or choose analytics and advertising separately. Rejecting is as easy as accepting, and nothing optional is switched on by default.</p>
      <p>To change or withdraw consent at any time, use the &ldquo;Cookie settings&rdquo; link in the site footer (or the account menu when signed in). Withdrawing stops analytics and advertising from loading on your next page view. You can also clear site data in your browser and manage ads in <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ad Settings</a>.</p>

      <h2>More detail</h2>
      <p>The providers behind these cookies are listed on the <a href="/subprocessors">subprocessors page</a>. How we handle the data they collect is in the <a href="/privacy">Privacy Policy</a>.</p>
    </>
  );
}

type Row = [string, string, string];

const CORE: Row[] = [
  ["Supabase", "Database, authentication and file storage", "Your account, resume, transcripts, scores and reports"],
  ["Vercel", "Hosting and edge functions, plus aggregate usage and page-performance measurement", "Requests to the site and the app"],
  ["Groq", "Primary AI inference for scoring and question generation", "Resume text and your answers"],
  ["Google (Gemini)", "AI inference fallback", "Resume text and your answers"],
  ["Cloudflare (Workers AI)", "Additional AI inference fallback", "Resume text and your answers"],
  ["Deepgram", "Primary speech-to-text for voice answers", "Your voice, streamed live for transcription"],
  ["Sarvam AI", "Text-to-speech, and speech-to-text fallback", "Question text; your voice only when it is the fallback"],
  ["Cartesia", "Secondary text-to-speech", "The interviewer's question text, not your answers"],
  ["Microsoft Azure", "Tertiary text-to-speech fallback", "Question text only"],
  ["Resend", "Transactional email delivery", "Your email address and the message being sent"],
  ["Razorpay", "Payment processing", "Payment details you enter at checkout. Card and UPI details never reach us."],
  ["Upstash", "Rate limiting and short-lived caching", "Not your resume or session transcripts"],
];

const OPTIONAL: Row[] = [
  ["Google Calendar", "Two-way calendar sync for interview scheduling, only if you connect it", "The calendar events needed for scheduling"],
  ["PostHog", "Product analytics, hosted in the United States, loaded only after you opt in", "Usage events. We do not send your email address or name."],
  ["Google Analytics 4", "Website analytics, enabled only after you opt in", "Website usage measurement"],
  ["Google AdSense", "Advertising on public blog, interview-question and salary pages, only after you opt in", "Advertising identifiers. Never loaded inside signed-in pages."],
];

function ProviderTable({ rows }: { rows: Row[] }) {
  return (
    <div className="lg-tablewrap">
      <table className="lg-table">
        <thead><tr><th scope="col">Provider</th><th scope="col">What it does</th><th scope="col">What it receives</th></tr></thead>
        <tbody>{rows.map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function SubprocessorsBody() {
  return (
    <>
      <p>These are the providers that process personal data on our behalf. Each does so under its own data processing terms and only for the purpose listed. We do not sell your data.</p>
      <h2>Needed to run the product</h2>
      <ProviderTable rows={CORE} />
      <p>Our providers process data in India, the United States and other regions where they operate (for example Supabase in Ireland).</p>
      <h2>Optional, only if you choose</h2>
      <ProviderTable rows={OPTIONAL} />
      <p>We do not send your resume or session transcripts to Razorpay, Resend, PostHog, Google Analytics, Upstash or AdSense.</p>
      <h2>Questions</h2>
      <p>This list matches the <a href="/privacy">Privacy Policy</a>. For questions about a provider, write to our <a href="/grievance">Grievance Officer</a> at <CopyEmailLink email="grievance@hirestepx.com" />.</p>
    </>
  );
}

function VoiceBody() {
  return (
    <>
      <h2>We do not store recordings</h2>
      <p>We do not store audio or video recordings of your sessions. If you answer by voice, your speech is streamed to our speech-to-text provider for live transcription and is not retained by us.</p>

      <h2>When the microphone is on</h2>
      <p>We use the microphone only during an active interview round. We do not collect location or contacts.</p>

      <h2>Who hears your voice</h2>
      <ul>
        <li><strong>Deepgram</strong> is the primary speech-to-text provider for voice answers.</li>
        <li><strong>Sarvam AI</strong> is the fallback if Deepgram is unavailable.</li>
        <li>If neither is available, your browser&apos;s built-in speech recognition may be used instead. It is run by your browser vendor under its own terms, not by us.</li>
      </ul>
      <p>Voice audio goes only to these providers, for live transcription.</p>

      <h2>What the interviewer&apos;s voice uses</h2>
      <p>The interviewer is spoken aloud by a text-to-speech provider. Sarvam AI, Cartesia and Microsoft Azure receive the interviewer&apos;s question text only, never your answers.</p>

      <h2>What we keep</h2>
      <p>The transcript of your answers is kept with your session until you delete your account. It powers your scores and report. See <a href="/retention">data retention and deletion</a>.</p>

      <h2>Your choices</h2>
      <p>You can delete your account and its transcripts at any time from Settings. For access, correction or erasure requests, write to the <a href="/grievance">Grievance Officer</a>.</p>
    </>
  );
}

function RetentionBody() {
  return (
    <>
      <h2>How long we keep your data</h2>
      <p>Your resume, transcripts, scores and reports are kept until you delete your account. We do not run an automatic transcript-deletion job.</p>

      <h2>What happens when you delete your account</h2>
      <ul>
        <li><strong>Immediately:</strong> your account is deactivated, and you are removed from employer discovery.</li>
        <li><strong>Within 7 days:</strong> sign in and you can restore it.</li>
        <li><strong>After 7 days:</strong> your profile, sessions, transcripts, resume text and uploaded resume files are permanently deleted.</li>
        <li><strong>Backups:</strong> copies in backups are overwritten within 30 days.</li>
        <li><strong>Payment records:</strong> kept in anonymised form for as long as tax law requires.</li>
      </ul>

      <h2>Employer accounts</h2>
      <p>An employer account is paused for 7 days so it can be restored. After that, the company profile, logo, jobs, shortlists and conversations are permanently deleted. The company name, website and logo are removed from payment records, and the sign-in email is replaced. Payment and order records, with the GSTIN and billing name on invoices, are kept for as long as tax law requires.</p>
      <p>{CREDIT_ON_DELETION_SENTENCE}</p>

      <h2>Switching off employer discovery</h2>
      <p>Turning discovery off removes you from employer search and new matches immediately. An unlock an employer has already paid for stays valid and they keep the details they received.</p>

      <h2>Getting a copy first</h2>
      <p>To get a copy of your data before you delete, email <CopyEmailLink email="grievance@hirestepx.com" />. We acknowledge within 24 hours and resolve within 15 days.</p>
    </>
  );
}

function AiScoringBody() {
  return (
    <>
      <h2>What the AI does</h2>
      <p>AI generates your interview questions from your resume and target role, scores your answers, and writes your report. How the scoring works is explained on the <a href="/methodology">methodology page</a>.</p>

      <h2>What it receives</h2>
      <p>Your resume text and your answers are sent to our AI providers for this: Groq as the primary, with Google (Gemini) and Cloudflare (Workers AI) as fallbacks. The full list is on the <a href="/subprocessors">subprocessors page</a>.</p>

      <h2>What the scores are, and are not</h2>
      <p>Practice scores reflect your performance in HireStepX sessions. They are not a certified assessment, and they are not independently verified. AI-generated feedback is a tool for self-improvement, not a substitute for professional career counselling. We do not guarantee any employment outcome.</p>

      <h2>If employers can see your scores</h2>
      <p>With employer discovery on, employers see a masked version of your practice profile, including skill and answer-structure scores, before they unlock you. You can switch this off any time in Settings. Details are in the <a href="/privacy">Privacy Policy</a>.</p>

      <h2>If a score looks wrong</h2>
      <p>Use the &ldquo;Dispute score&rdquo; link inside the session report. We review every dispute within 24 hours. For other complaints, write to the <a href="/grievance">Grievance Officer</a>.</p>
    </>
  );
}

function EmployerTermsBody() {
  return (
    <>
      <p>These terms apply to anyone who registers an employer account or pays to unlock a candidate. They sit alongside the main <a href="/terms">Terms of Service</a>.</p>
      <EmployerTermsList />
      <h2>Related</h2>
      <p>See the <a href="/refund#employers">employer section of the refund policy</a> and how candidate data is handled in the <a href="/privacy#employer-data">Privacy Policy</a>.</p>
    </>
  );
}

const BODIES: Record<string, () => ReactNode> = {
  privacy: PrivacyBody, terms: TermsBody, refund: RefundBody, cookies: CookiesBody, retention: RetentionBody,
  voice: VoiceBody, "ai-scoring": AiScoringBody, subprocessors: SubprocessorsBody, "employer-terms": EmployerTermsBody, grievance: GrievanceBody,
};

const GROUPS: Group[] = ["Core policies", "Your data", "Employers", "Help"];

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
    <Shell active="talent">
      <style>{legalCss}</style>
      <section className="lg-hero">
        <div className="hx-wrap">
          <a data-no-underline className="lg-back" href="/legal">All legal documents</a>
          <h1>{doc.title}</h1>
          <p className="lg-meta">Last updated {doc.updated}. Questions: <CopyEmailLink email="hello@hirestepx.com" />. Privacy or data complaints: <CopyEmailLink email="grievance@hirestepx.com" />.</p>
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
  return (
    <Shell active="talent">
      <style>{legalCss}</style>
      <section className="lg-hero">
        <div className="hx-wrap">
          <h1>Legal and trust</h1>
          <p className="lg-meta">Every policy that covers your data, your payments and your account, in plain English, each with its last updated date.</p>
        </div>
      </section>
      <section className="lg-body">
        <div className="hx-wrap">
          {GROUPS.map((g) => (
            <div className="lg-group" key={g}>
              <h2>{g}</h2>
              <div className="lg-list">
                {LEGAL_META.filter((d) => d.group === g).map((d) => (
                  <a key={d.slug} data-no-underline href={`/${d.slug}`}><b>{d.title}</b><span>{d.blurb}</span><em>Updated {d.updated}</em></a>
                ))}
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
.lg-hero h1 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; margin: 12px 0 0; text-wrap: balance; }
.lg-back { display: inline-block; font-size: 15px; color: var(--ink-2); }
.lg-back::before { content: '\\2190'; margin-right: 8px; }
.lg-back:hover { color: var(--ink); }
.lg-meta { margin: 16px 0 0; max-width: 64ch; font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.lg-meta a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.lg-body { padding: 48px 0 72px; }
.lg-grid { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 64px; align-items: start; }
.lg-toc { position: sticky; top: 96px; display: grid; gap: 4px; padding-right: 8px; }
.lg-toc h2 { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 8px; }
.lg-toc a { display: block; padding: 6px 0; font-size: 14px; line-height: 1.35; color: var(--ink-2); text-decoration: none; }
.lg-toc a:hover { color: var(--btn); }
.lg-prose { grid-column: 2; min-width: 0; max-width: 72ch; font-size: 17px; line-height: 1.7; color: var(--ink); }
.lg-prose > :first-child { margin-top: 0; }
.lg-prose h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 500; margin: 48px 0 12px; scroll-margin-top: 96px; }
.lg-prose p, .lg-prose ul { margin: 0 0 16px; }
.lg-prose ul { padding-left: 22px; display: grid; gap: 10px; }
.lg-prose li::marker { color: var(--ink-3); }
.lg-prose strong { font-weight: 600; }
.lg-prose em { font-style: normal; font-weight: 500; }
.lg-prose a { color: var(--btn); text-decoration: underline; text-underline-offset: 3px; }
.lg-tablewrap { overflow-x: auto; margin: 0 0 24px; border: 1px solid var(--line); border-radius: 14px; }
.lg-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 15px; line-height: 1.5; }
.lg-table th, .lg-table td { text-align: left; vertical-align: top; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.lg-table thead th { background: var(--wash); font-weight: 600; font-size: 13px; color: var(--ink-2); }
.lg-table tbody th { font-weight: 600; white-space: nowrap; }
.lg-table tbody tr:last-child th, .lg-table tbody tr:last-child td { border-bottom: 0; }
.lg-more { padding: 0 0 72px; }
.lg-more h2, .lg-group h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 24px; letter-spacing: -0.02em; font-weight: 500; margin: 0 0 16px; }
.lg-group { margin-bottom: 40px; }
.lg-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.lg-list a { display: grid; gap: 6px; align-content: start; padding: 22px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--white); color: var(--ink); transition: border-color .15s, box-shadow .15s; }
.lg-list a:hover { border-color: var(--btn); box-shadow: 0 8px 24px oklch(0.4 0.12 280 / 0.1); }
.lg-list b { font-size: 17px; font-weight: 600; }
.lg-list span { font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.lg-list em { font-style: normal; font-size: 13px; color: var(--ink-3); margin-top: 4px; }
@media (max-width: 900px) {
  .lg-hero { padding: 40px 0 24px; }
  .lg-hero h1 { font-size: 38px; }
  .lg-grid { grid-template-columns: 1fr; gap: 0; }
  .lg-toc { display: none; }
  .lg-prose { grid-column: 1; font-size: 16px; }
  .lg-prose h2 { font-size: 24px; margin-top: 36px; }
  .lg-list { grid-template-columns: 1fr; }
}
`;
