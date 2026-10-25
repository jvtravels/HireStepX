"use client";
import { useEffect, useState, type ReactNode } from "react";
import Skel from "./Skel";
import { BriefcaseBusiness, Check, FileText, Lock, Mic, ShieldCheck, type LucideIcon } from "lucide-react";
import { CandFaq } from "./Extra";
import { Arrow, Close, Shell, Win } from "./Pages";
import { delay, reduced, useReveal } from "./motion";

/* ── Hero: a live voice round ── */

const VR_Q = "Tell me about a time you improved something.";
const VR_BEFORE = "I worked on checkout. It was, *um,* slow, so I *basically* changed how we loaded the payment step and it felt, *like,* a lot better after.".split(" ");
const VR_AFTER = "Checkout was losing one in five buyers on slow phones. I moved the payment step to load on demand, and load time fell from 3.4s to 1.9s.".split(" ");

const plain = (a: string[]) => a.join(" ").replace(/\*/g, "");

function VoiceRound() {
  const [fixed, setFixed] = useState(false);
  const [w, setW] = useState(0);
  const words = fixed ? VR_AFTER : VR_BEFORE;
  const done = w >= words.length;

  useEffect(() => {
    if (reduced()) { setW(words.length); return; }
    setW(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setW(i);
      if (i >= words.length) clearInterval(id);
    }, 130);
    return () => clearInterval(id);
  }, [words]);

  const fillers = words.slice(0, w).filter((x) => x.startsWith("*")).length;
  const score = fixed ? 86 : 64;
  return (
    <div className="vo">
      <div className="vo-q"><span className="hx-kicker">Interview question</span><p>{VR_Q}</p></div>
      <div className={`vo-orb${done ? " done" : ""}${fixed ? " ok" : ""}`}>
        <svg viewBox="0 0 176 176" aria-hidden="true">
          <circle className="vo-track" cx="88" cy="88" r="76" />
          <circle className="vo-arc" cx="88" cy="88" r="76" style={{ strokeDashoffset: 477.5 * (1 - (done ? score / 100 : 0)) }} />
        </svg>
        <i className="vo-ripple" /><i className="vo-ripple" style={{ animationDelay: "1s" }} />
        <div className="vo-core">
          {done
            ? <><b>{score}</b><span>out of 100</span></>
            : <><Mic size={26} strokeWidth={1.75} aria-hidden="true" /><span>Listening</span></>}
        </div>
      </div>
      <div className="vo-capw">
        <p className="vo-cap" aria-live="polite" key={String(fixed)}>
          {words.slice(0, w).map((x, i) => x.startsWith("*")
            ? <span key={i} className="vo-fill">{x.replace(/\*/g, "")} </span>
            : fixed && /\d/.test(x) ? <mark key={i} className="cd-add">{x} </mark> : <span key={i}>{x} </span>)}
          {!done && <span className="hc-caret" />}
        </p>
        <span className="vo-cap vo-sz" aria-hidden="true">{plain(VR_BEFORE)}</span>
        <span className="vo-cap vo-sz" aria-hidden="true">{plain(VR_AFTER)}</span>
      </div>
      <div className="vo-row">
        <span className={`vo-chip${fillers ? " warn" : ""}`}>{fillers} filler {fillers === 1 ? "word" : "words"}</span>
        <button type="button" className={`hc-chip${done ? "" : " vo-hide"}`} onClick={() => setFixed(!fixed)}>{fixed ? "Play it again" : "Hear a stronger version"}</button>
      </div>
    </div>
  );
}

function CandHero() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="cx-hero">
      <div ref={ref} className={`hx-wrap cx-hero-in hx-rv${on ? " on" : ""}`}>
        <div className="cx-copy">
          <span className="hx-kicker hx-ri" style={delay(0)}>For candidates</span>
          <h1 className="cx-h1 hx-ri" style={delay(1)}>Practise the interview. <b>Get shortlisted</b> by recruiters.</h1>
          <p className="cx-lede hx-ri" style={delay(2)}>Answer interview questions out loud and get a score with simple tips. Recruiters hiring for your skills can then see your proof.</p>
          <div className="cx-cta hx-ri" style={delay(3)}>
            <a data-no-underline className="hx-btn lg" href="/signup">Start practising <Arrow /></a>
            <a className="cx-link" href="#how">See how it works</a>
          </div>
          <p className="cx-fine hx-ri" style={delay(4)}>2 free sessions, then ₹9 a session. No card needed.</p>
        </div>
        <Skel className="hx-stage cx-demo" style={delay(2)}><VoiceRound /></Skel>
      </div>
    </section>
  );
}

/* ── The rewrite: one answer, four passes ── */

type Fix = { title: string; body: string; score: number; lit: string[] };
const BASE: Fix = { title: "Your first answer", body: "It says what you did, but not why it mattered.", score: 58, lit: ["A"] };
const FIXES: Fix[] = [
  { title: "Tell them why it mattered", body: "Add one line on the problem. Interviewers can't score a problem they never heard about.", score: 70, lit: ["S", "A"] },
  { title: "Say \"I\", not \"we\"", body: "What you personally did is what they write down.", score: 81, lit: ["S", "T", "A"] },
  { title: "End on a number", body: "A result with a figure sticks in their memory. Say it, then stop talking.", score: 91, lit: ["S", "T", "A", "R"] },
];

const FULL_ANSWER = "Customers waited two days for a reply and our rating had dropped to 3.8. I set up saved replies and sorted tickets by urgency each morning. Replies now take 6 hours instead of 48, and our rating rose to 4.5.";

function RewriteStory() {
  const [n, setN] = useState(0);
  const [touched, setTouched] = useState(false);
  const { ref, on } = useReveal<HTMLDivElement>();
  useEffect(() => {
    if (!on || touched || reduced() || n >= FIXES.length) return;
    const id = setTimeout(() => setN((v) => v + 1), n === 0 ? 1600 : 2200);
    return () => clearTimeout(id);
  }, [on, touched, n]);
  const pick = (k: number) => { setTouched(true); setN(n === k + 1 ? k : k + 1); };
  const P = n === 0 ? BASE : FIXES[n - 1];
  return (
    <section className="pg-sec ia" id="rewrite">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <Head kicker="Example answer" title="Same story, a much better answer." lede="Three small fixes take one answer from 58 to 91 out of 100." />
        <div className="ia-grid hx-ri" style={delay(1)}>
          <Skel className="ia-stage hx-stage-warm">
            <Win left="Your answer" right={n === 0 ? "First draft" : `${n} of 3 fixes`} alt="An interview answer improving as three fixes are applied, with its score rising">
              <div className="ia-card">
                <p className="ia-q">Tell me about a time you improved something.</p>
                <div className="ia-a">
                  <p aria-live="polite">
                    {n >= 1 && <mark className="cd-add">Customers waited two days for a reply and our rating had dropped to 3.8. </mark>}
                    {n >= 2 ? <mark className="cd-add">I set up saved replies and sorted tickets by urgency each morning.</mark> : "I worked on our support team and made replies faster."}
                    {n >= 3 && <mark className="cd-add"> Replies now take 6 hours instead of 48, and our rating rose to 4.5.</mark>}
                  </p>
                  <p className="ia-sz" aria-hidden="true">{FULL_ANSWER}</p>
                </div>
                <div className="ia-foot">
                  <ul className="cd-star" aria-label="Which parts your answer has">
                    {[["S", "The problem"], ["T", "Your job"], ["A", "What you did"], ["R", "The result"]].map(([l, w]) => <li key={l} className={P.lit.includes(l) ? undefined : "miss"}>{w}</li>)}
                  </ul>
                  <div className="ia-score"><b key={P.score}>{P.score}</b><span>out of 100</span></div>
                </div>
                <div className="ia-meter" aria-hidden="true"><i style={{ width: `${P.score}%` }} /></div>
              </div>
            </Win>
          </Skel>
          <div className="ia-fixes">
            <ol>
              {FIXES.map((f, k) => {
                const done = n > k;
                return (
                  <li key={f.title}>
                    <button type="button" className={`ia-fix${done ? " done" : ""}`} aria-pressed={done} onClick={() => pick(k)}>
                      <span className="ia-n" aria-hidden="true">{done ? <Check size={16} strokeWidth={2.5} /> : k + 1}</span>
                      <span className="ia-t"><b>{f.title}</b><span>{f.body}</span></span>
                      <em>+{f.score - (k === 0 ? BASE.score : FIXES[k - 1].score)} points</em>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button type="button" className={`ia-reset${n === 0 ? " off" : ""}`} disabled={n === 0} onClick={() => { setTouched(true); setN(0); }}>Start over</button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Aim it at the job ── */

/* ── Pricing ── */

const PLANS: { name: string; price: string; unit: string; sessions: string; note: string; feat?: boolean; cta: string }[] = [
  { name: "Free", price: "₹0", unit: "to start", sessions: "2 sessions", note: "Included with every new account.", cta: "Try 2 free sessions" },
  { name: "Sprint Pack", price: "₹39", unit: "for 5 sessions", sessions: "₹7.80 a session", note: "Valid for 30 days. Good for a campus drive or a job switch.", feat: true, cta: "Get the pack" },
  { name: "Single session", price: "₹9", unit: "a session", sessions: "Pay as you go", note: "Your credit never expires.", cta: "Buy one" },
];

function CandPricing() {
  return (
    <Sec id="pricing" kicker="Pricing" title={<>Your first 2 sessions are <b>free</b>.</>} lede="After that, pay only for what you practise. No subscription.">
      <div className="pq">
        {PLANS.map((pl) => (
          <div key={pl.name} className={`pq-card${pl.feat ? " feat" : ""}`}>
            <span className="pq-name">{pl.name}{pl.feat && <i>Best value</i>}</span>
            <p className="pq-price"><b>{pl.price}</b><span>{pl.unit}</span></p>
            <p className="pq-sess">{pl.sessions}</p>
            <p className="pq-note">{pl.note}</p>
            <a data-no-underline className={`hx-btn lg${pl.feat ? "" : " alt"}`} href="/signup">{pl.cta} <Arrow /></a>
          </div>
        ))}
      </div>
      <p className="pq-foot"><a href="/pricing">See full pricing</a></p>
    </Sec>
  );
}

/* ── The whole journey: rounds, readiness, delivery, gaps, proof ── */

const I = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

const HOW: { t: string; d: string }[] = [
  { t: "Practise out loud", d: "An AI interviewer asks the questions and you answer like the real thing. A round takes about 10 to 25 minutes." },
  { t: "Find out what to fix", d: "Get a score out of 100 and simple tips. Try again until you are happy." },
  { t: "Get seen by recruiters", d: "Recruiters hiring for your skills see your verified proof. Your name stays hidden until you say yes." },
];

function Head({ kicker, title, lede }: { kicker: string; title: ReactNode; lede?: string }) {
  return (
    <div className="cx-head hx-ri" style={delay(0)}>
      <span className="hx-kicker">{kicker}</span>
      <h2 className="hx-h2">{title}</h2>
      {lede ? <p>{lede}</p> : null}
    </div>
  );
}

function Sec({ id, band, kicker, title, lede, children }: { id?: string; band?: boolean; kicker: string; title: ReactNode; lede?: string; children: ReactNode }) {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className={`pg-sec${band ? " pg-band" : ""}`} id={id}>
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <Head kicker={kicker} title={title} lede={lede} />
        <div className="hx-ri" style={delay(1)}>{children}</div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <Sec id="how" kicker="How it works" title={<>Practise, improve, <b>get shortlisted</b>.</>}>
      <ol className="cx-steps">
        {HOW.map((x, i) => (
          <li key={x.t}><span className="cx-n" aria-hidden="true">{i + 1}</span><h3>{x.t}</h3><p>{x.d}</p></li>
        ))}
      </ol>
    </Sec>
  );
}

const PROOF: { Icon: LucideIcon; t: string; d: string }[] = [
  { Icon: FileText, t: "Know where your resume stands", d: "Get a score out of 100, a check that hiring software can read it, and a rewrite for weak lines." },
  { Icon: ShieldCheck, t: "Proof, not promises", d: "Skills like communication and problem solving show as verified once you have practised them." },
  { Icon: BriefcaseBusiness, t: "Skip the repeat questions", d: "Add your notice period once. Only employers you accept can see it." },
];

function Proof() {
  return (
    <Sec id="proof" band kicker="Your proof" title={<>Practice that <b>gets you shortlisted</b>.</>} lede="Every session adds proof of what you can do.">
      <div className="pf">
        <ul className="pf-list">
          {PROOF.map((p, i) => <li key={p.t} style={delay(i)}><span className="pf-ico"><p.Icon {...I} /></span><div><h3>{p.t}</h3><p>{p.d}</p></div></li>)}
        </ul>
        <Skel className="pf-card hx-stage hx-stage-warm">
          <div className="pf-in">
            <span className="hx-kicker">What a recruiter sees</span>
            <h3>Product designer</h3>
            <p className="pf-meta">5 years · Pune · name hidden</p>
            <ul className="pf-ev">
              <li style={delay(1)}><ShieldCheck {...I} size={16} />Communication<em>Verified</em></li>
              <li style={delay(2)}><ShieldCheck {...I} size={16} />Problem solving<em>Verified</em></li>
              <li style={delay(3)}><ShieldCheck {...I} size={16} />Leadership<em>Verified</em></li>
              <li className="no" style={delay(4)}><ShieldCheck {...I} size={16} />Salary negotiation<em>Not yet</em></li>
            </ul>
            <p className="pf-lock"><Lock {...I} size={14} />Name and contact hidden until you say yes.</p>
          </div>
        </Skel>
      </div>
    </Sec>
  );
}

export function CandidatesPage() {
  return (
    <Shell active="talent">
      <div className="cxp">
        <CandHero />
        <HowItWorks />
        <RewriteStory />
        <Proof />
        <CandPricing />
        <CandFaq />
        <div className="cx-close"><Close
          kicker="Ready when you are"
          title={<>Start with <b>one answer</b>.</>}
          body="Practise out loud, see exactly what to fix, and let recruiters find the proof."
          primary={["Start practising", "/signup"]}
          secondary={["Hire from proof", "/employers"]}
        /></div>
      </div>
    </Shell>
  );
}
