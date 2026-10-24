"use client";
import { useEffect, useState } from "react";
import { useSlider } from "./motion";
import { Arrow, Close, Shell } from "./Pages";
import { FaqBlock } from "./Extra";
import Skel from "./Skel";

export type Audience = "cand" | "emp";

const CAND_QA: [string, string][] = [
  ["Do I need a card for the free sessions?", "No. Every new account gets 2 free sessions with no card on file."],
  ["Does my credit expire?", "Single session credit never expires. A Sprint Pack is valid for 30 days, so buy singles if you will spread your practice out."],
  ["How do I pay?", "UPI, card or netbanking. There is no subscription and nothing renews on its own."],
  ["What if something goes wrong?", "Read the refund policy for what is covered, or write to us from the contact page."],
];

const EMP_QA: [string, string][] = [
  ["What is free?", "Posting a role, the ranked matches, skill scores, practice history, their answers, and comparing or rejecting anyone."],
  ["What do I pay for?", "Only to unlock a candidate's name and contact. That is ₹59 per person, or ₹299 for ten."],
  ["Do I pay before I can read scores?", "No. Read first, decide after. You only pay for the people you pick."],
  ["Is there a plan or contract?", "No. You pay per unlock, so a quiet month costs nothing."],
];

type Stage = { cap: string; rows: [string, string, boolean?][] };

const CAND_STAGE: Stage[] = [
  { cap: "Your first 2 sessions", rows: [["Session 1", "Free"], ["Session 2", "Free"], ["Card on file", "Not needed"]] },
  { cap: "How long credit lasts", rows: [["Single session", "Never expires"], ["Sprint Pack", "30 days"]] },
  { cap: "Ways to pay", rows: [["UPI", "Accepted"], ["Card", "Accepted"], ["Netbanking", "Accepted"], ["Subscription", "None", true]] },
  { cap: "If something goes wrong", rows: [["Refund policy", "Read it"], ["Contact page", "Write to us"]] },
];

const EMP_STAGE: Stage[] = [
  { cap: "What costs nothing", rows: [["Posting a role", "Free"], ["Ranked matches and scores", "Free"], ["Comparing and rejecting", "Free"]] },
  { cap: "What you pay for", rows: [["Unlock one candidate", "₹59"], ["Unlock ten candidates", "₹299"]] },
  { cap: "Order of events", rows: [["Read scores", "Free"], ["Decide who to meet", "Free"], ["Unlock contact", "Paid"]] },
  { cap: "Commitment", rows: [["Plan or contract", "None", true], ["Quiet month", "₹0"]] },
];

function PriceStage({ stages, i }: { stages: Stage[]; i: number }) {
  const st = stages[i];
  return (
    <div className="hx-priv-stage" aria-live="polite">
      <div className="hx-priv-top"><span className="hx-priv-lab"><i className="hx-gdot" />{st.cap}</span></div>
      <div className="hx-priv-body" key={i}>
        <div className="hx-priv-card">
          <p className="hx-mini-cap">{st.cap}</p>
          {st.rows.map(([n, t, gone]) => (
            <div className="hx-pv-row" key={n}><div><b>{n}</b></div><em className={`hx-pv-tag${gone ? " gone" : ""}`}>{t}</em></div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Plan = { name: string; price: string; unit: string; blurb: string; points: string[]; cta: string; href: string; best?: boolean };

const CAND_PLANS: Plan[] = [
  { name: "Free", price: "₹0", unit: "for 2 sessions", blurb: "Try a real round before you pay anything.", points: ["Scored answers and feedback", "Every round type", "No card needed"], cta: "Start free", href: "/signup" },
  { name: "Sprint Pack", price: "₹39", unit: "for 5 sessions", blurb: "Works out to ₹7.80 a session, for a campus drive or a job switch.", points: ["Everything included", "Valid for 30 days", "Cheapest per session"], cta: "Get the pack", href: "/signup", best: true },
  { name: "Single session", price: "₹9", unit: "per session", blurb: "Pay as you go and practise on your own schedule.", points: ["Everything included", "Credit never expires", "Buy one at a time"], cta: "Buy one", href: "/signup" },
];

const EMP_PLANS: Plan[] = [
  { name: "Read and rank", price: "₹0", unit: "always", blurb: "See who fits before you spend anything.", points: ["Ranked matches for every role", "Scores and the answers behind them", "Compare and reject anyone"], cta: "Post a role", href: "/signup" },
  { name: "Unlock ten", price: "₹299", unit: "for ten people", blurb: "₹29.90 each. Use them whenever you like.", points: ["Name, phone and email", "Lowest cost per person", "Pay only for people you pick"], cta: "Start hiring", href: "/signup", best: true },
  { name: "Unlock one", price: "₹59", unit: "per person", blurb: "Reach a single candidate when you need to.", points: ["Name, phone and email", "No bundle to commit to", "Pay only for people you pick"], cta: "Start hiring", href: "/signup" },
];

const TRUST = ["UPI, card and netbanking", "No auto-renew", "Prices in INR"];

function PlanTable({ plans }: { plans: Plan[] }) {
  return (
    <>
      <div className="prc-grid" role="list">
        {plans.map((p) => (
          <div key={p.name} role="listitem" className={`prc-plan${p.best ? " best" : ""}`}>
            <b className="prc-name">{p.name}{p.best && <i>Best value</i>}</b>
            <p className="prc-cost"><b>{p.price}</b><span>{p.unit}</span></p>
            <p className="prc-blurb">{p.blurb}</p>
            <ul className="prc-pts">{p.points.map((t) => <li key={t}>{t}</li>)}</ul>
            <a data-no-underline className={`hx-btn lg${p.best ? "" : " alt"}`} href={p.href}>{p.cta} <Arrow /></a>
          </div>
        ))}
      </div>
      <ul className="prc-trust">{TRUST.map((t) => <li key={t}>{t}</li>)}</ul>
    </>
  );
}

export function PricingPage({ initial = "cand" }: { initial?: Audience }) {
  const [aud, setAud] = useState<Audience>(initial);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("for") === "hiring") setAud("emp");
  }, []);
  const cand = aud === "cand";
  const segRef = useSlider<HTMLDivElement>(aud);
  return (
    <Shell active="pricing">
      <style>{pricingCss}</style>
      <section className="hx-hero prc-hero">
        <div className="hx-wrap">
          <h1 className="hx-h1"><span key={aud} className="prc-sw">{cand ? <>Your first 2 sessions are <b>free</b>. After that, pay only for what you use.</> : <>Read every score for free. Pay only to <b>reach someone</b>.</>}</span></h1>
          <p className="hx-lede">{cand ? "No subscription and no card to start. Buy a pack or single sessions when you need more." : "Post roles, see ranked matches and read the answers behind every score. You pay only to unlock the people you pick."}</p>
          <div ref={segRef} className="prc-seg" role="tablist" aria-label="Pricing for">
            <button type="button" role="tab" aria-selected={cand} className={cand ? "on" : ""} onClick={() => setAud("cand")}>I am practising</button>
            <button type="button" role="tab" aria-selected={!cand} className={!cand ? "on" : ""} onClick={() => setAud("emp")}>I am hiring</button>
          </div>
          <Skel className="hx-stage prc-stage" replayKey={cand ? 0 : 1}>
            <PlanTable key={aud} plans={cand ? CAND_PLANS : EMP_PLANS} />
          </Skel>
        </div>
      </section>
      <FaqBlock key={aud} id="pricing-faq" title={<>Pricing, <b>answered plainly</b>.</>} qa={cand ? CAND_QA : EMP_QA} stage={(i) => <PriceStage stages={cand ? CAND_STAGE : EMP_STAGE} i={i} />} />
      {cand ? (
        <Close kicker="Ready when you are" title={<>Start with <b>one answer</b>.</>} body="Practise out loud, see exactly what to fix, and pay nothing for your first 2 sessions." primary={["Practise free", "/signup"]} secondary={["Hire from proof", "/employers"]} notes={["2 free sessions", "No card needed", "No subscription"]} />
      ) : (
        <Close kicker="Ready when you are" title={<>See who fits before you spend a rupee.</>} body="Post a role, read the ranking, and pay only for the people you want to meet." primary={["Start hiring", "/signup"]} secondary={["Talk to us", "/contact"]} notes={["Posting is free", "Scores are free to read", "Pay only to contact"]} />
      )}
    </Shell>
  );
}

const pricingCss = `
.prc-hero { padding-bottom: 16px; }
.prc-hero > .hx-wrap { text-align: center; }
.prc-hero .hx-h1 { font-size: 52px; margin: 48px auto 0; max-width: 26ch; text-wrap: balance; }
.prc-hero .hx-lede { margin: 12px auto 0; max-width: 60ch; font-size: 16px; }
.prc-hero .prc-seg { margin: 28px auto 0; }
.prc-stage { max-width: 1120px; width: 100%; margin-left: auto; margin-right: auto; margin-top: 28px; }
.prc-seg { display: flex; width: max-content; max-width: 100%; margin: 0 auto 40px; padding: 4px; gap: 4px; border-radius: 12px; background: var(--wash); border: 1px solid var(--line); }
.prc-seg button { appearance: none; border: 0; background: transparent; font: inherit; font-size: 15px; font-weight: 500; color: var(--ink-2); min-height: 44px; padding: 0 22px; border-radius: 9px; cursor: pointer; transition: background .15s, color .15s; }
.prc-seg button:hover { color: var(--ink); }
.prc-seg { position: relative; }
.prc-seg::before { content: ''; position: absolute; left: 0; top: 0; height: var(--sh, 0); width: var(--sw, 0); border-radius: 9px; background: var(--white); box-shadow: 0 0 0 1px var(--line); transform: translate(var(--sx, 0), var(--sy, 0)); opacity: 0; transition: transform .28s cubic-bezier(.22,1,.36,1), width .28s cubic-bezier(.22,1,.36,1); pointer-events: none; }
.prc-seg[data-ready]::before { opacity: 1; }
.prc-seg button { position: relative; }
.prc-seg button.on { color: var(--ink); }
.prc-seg:not([data-ready]) button.on { background: var(--white); box-shadow: 0 0 0 1px var(--line); }
.prc-sw { display: block; animation: prc-sw .22s cubic-bezier(.22,1,.36,1); }
@keyframes prc-sw { from { opacity: 0; transform: translateY(6px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
@media (prefers-reduced-motion: reduce) { .prc-seg::before { transition: none; } .prc-sw { animation: none; } }
.prc-stage { padding: 24px; }
.prc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; text-align: left; }
.prc-plan { display: flex; flex-direction: column; gap: 14px; padding: 28px; border-radius: 18px; background: var(--white); border: 1px solid var(--line); }
.prc-plan.best { border: 2px solid var(--btn); padding: 27px; box-shadow: 0 12px 32px oklch(0.4 0.12 280 / 0.14); }
.prc-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 16px; font-weight: 600; color: var(--ink); }
.prc-name i { font-style: normal; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 99px; color: var(--white); background: var(--btn); }
.prc-cost { margin: 0; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.prc-cost b { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 56px; line-height: 1; font-weight: 600; letter-spacing: -0.04em; color: var(--ink); }
.prc-cost span { font-size: 15px; color: var(--ink-2); }
.prc-blurb { margin: 0; font-size: 16px; line-height: 1.5; color: var(--ink-2); min-height: 48px; }
.prc-pts { margin: 4px 0 8px; padding: 18px 0 0; border-top: 1px solid var(--line); list-style: none; display: grid; gap: 10px; flex: 1; align-content: start; font-size: 15px; line-height: 1.45; color: var(--ink); }
.prc-pts li { position: relative; padding-left: 24px; }
.prc-pts li::before { content: ''; position: absolute; left: 2px; top: 6px; width: 10px; height: 6px; border-left: 2px solid var(--btn); border-bottom: 2px solid var(--btn); transform: rotate(-45deg); }
.prc-plan .hx-btn { justify-content: center; text-align: center; }
.prc-trust { margin: 22px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 28px; font-size: 14px; color: var(--ink-2); }
.prc-trust a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
@container (max-width: 900px) {
  .prc-hero { padding-bottom: 48px; }
  .prc-hero .hx-h1 { font-size: 34px; margin-top: 20px; }
  .prc-hero .hx-lede { font-size: 15px; }
  .prc-seg { width: 100%; }
  .prc-seg button { flex: 1; padding: 0 12px; }
  .prc-grid { grid-template-columns: 1fr; }
  .prc-plan { padding: 22px; }
  .prc-plan.best { padding: 21px; }
  .prc-cost b { font-size: 46px; }
  .prc-blurb { min-height: 0; }
}
`;
