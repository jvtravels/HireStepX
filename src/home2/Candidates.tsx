"use client";
import { useEffect, useState, type ReactNode } from "react";
import Skel from "./Skel";
import { ArrowRight, BriefcaseBusiness, Check, FileText, Lock, Mic, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { CandFaq } from "./Extra";
import { Arrow, Close, Shell, Win } from "./Pages";
import { delay, reduced, useReveal } from "./motion";

/* ── Hero: a practice round, before and after ── */

const FILLERS = new Set(["um,", "basically", "like,"]);
const SPOKEN = "I worked on checkout. It was, um, slow, so I basically changed how we loaded the payment step and it felt, like, a lot better after.".split(" ");
const BARS = [30, 55, 40, 80, 60, 95, 45, 70, 35, 85, 50, 75, 40, 90, 55, 65, 30, 80, 45, 60];
const CHECKS_FIRST = [
  { ok: true, text: "Picked a clear example" },
  { ok: false, text: "3 filler words: um, basically, like" },
  { ok: false, text: "No numbers to show the result" },
];
const CHECKS_AFTER = [
  { ok: true, text: "Picked a clear example" },
  { ok: true, text: "No filler words" },
  { ok: true, text: "Result shown with numbers" },
];
const STATUS = ["Question asked", "Listening", "Scored", "Scored again"];

function PracticeDemo() {
  const [phase, setPhase] = useState(0);
  const [words, setWords] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduced()) {
      timers.push(setTimeout(() => { setWords(SPOKEN.length); setPhase(2); }, 0));
    } else {
      timers.push(setTimeout(() => {
        setPhase(1);
        SPOKEN.forEach((_, k) => timers.push(setTimeout(() => setWords(k + 1), 120 * (k + 1))));
        timers.push(setTimeout(() => setPhase(2), 120 * SPOKEN.length + 700));
      }, 1000));
    }
    return () => timers.forEach(clearTimeout);
  }, [run]);

  const restart = () => { setPhase(0); setWords(0); setRun((r) => r + 1); };
  const improved = phase === 3;
  const score = improved ? 86 : 64;
  const checks = improved ? CHECKS_AFTER : CHECKS_FIRST;
  return (
    <div className="pd">
      <div className="pd-top">
        <span className="pd-lab">Practice round</span>
        <span className={`pd-status${phase === 1 ? " live" : ""}`} aria-live="polite"><i aria-hidden="true" />{STATUS[phase]}</span>
      </div>
      <div className="pd-q">
        <span className="pd-lab">The interviewer asks</span>
        <p>Tell me about a time you improved something.</p>
      </div>
      <div className={`pd-ans${phase >= 1 ? " on" : ""}`}>
        <div className="pd-ans-top">
          <span className="pd-lab"><Mic size={14} strokeWidth={2} aria-hidden="true" />You said</span>
          <span className={`pd-wave${phase === 1 ? " live" : ""}`} aria-hidden="true">
            {BARS.map((h, k) => <i key={k} style={{ ["--h" as string]: `${h}%`, ["--d" as string]: `${(k % 7) * 90}ms` }} />)}
          </span>
        </div>
        <div className="pd-stack">
          <p className={improved ? "off" : ""}>
            {SPOKEN.map((w, k) => <span key={k}><span className={`pd-w${k < words ? " on" : ""}${FILLERS.has(w) ? " pd-fill" : ""}`}>{w}</span>{" "}</span>)}
          </p>
          <p className={improved ? "" : "off"}>Checkout was losing one in five buyers on slow phones. I moved the payment step to load on demand, and load time fell from <mark className="cd-add">3.4s</mark> to <mark className="cd-add">1.9s</mark>.</p>
        </div>
      </div>
      <div className={`pd-res${phase >= 2 ? " on" : ""}`}>
        <div className="pd-score">
          <div className="pd-num"><b>{phase >= 2 ? score : "\u2013"}</b><span>out of 100</span></div>
          <div className="pd-bar"><i style={{ width: phase >= 2 ? `${score}%` : "0%" }} /></div>
        </div>
        <ul className="pd-checks">
          {checks.map((c) => (
            <li key={c.text} className={c.ok ? "ok" : "no"}>
              {c.ok ? <Check size={16} strokeWidth={2.5} aria-label="Good" /> : <X size={16} strokeWidth={2.5} aria-label="Needs work" />}
              {c.text}
            </li>
          ))}
        </ul>
        <button type="button" className="pd-act" onClick={improved ? restart : () => setPhase(3)} tabIndex={phase >= 2 ? 0 : -1}>
          {improved ? "Start over" : "Answer again with the tips"}
        </button>
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
        <Skel className="hx-stage cx-demo" style={delay(2)}><PracticeDemo /></Skel>
      </div>
    </section>
  );
}

/* ── The rewrite: one answer, four passes ── */

type Fix = { title: string; body: string; gain: number; letter: string };
const BASE_SCORE = 58;
const FIXES: Fix[] = [
  { title: "Tell them why it mattered", body: "Add one line on the problem. Interviewers can't score a problem they never heard about.", gain: 12, letter: "S" },
  { title: "Say \"I\", not \"we\"", body: "What you personally did is what they write down.", gain: 11, letter: "T" },
  { title: "End on a number", body: "A result with a figure sticks in their memory. Say it, then stop talking.", gain: 10, letter: "R" },
];

const FULL_ANSWER = "Customers waited two days for a reply and our rating had dropped to 3.8. I set up saved replies and sorted tickets by urgency each morning. Replies now take 6 hours instead of 48, and our rating rose to 4.5.";

function RewriteStory() {
  const [applied, setApplied] = useState<boolean[]>(() => FIXES.map(() => false));
  const [touched, setTouched] = useState(false);
  const { ref, on } = useReveal<HTMLDivElement>();
  const n = applied.filter(Boolean).length;
  useEffect(() => {
    if (!on || touched || reduced()) return;
    const next = applied.indexOf(false);
    if (next === -1) return;
    const id = setTimeout(() => setApplied((a) => a.map((v, k) => v || k === next)), n === 0 ? 1600 : 2200);
    return () => clearTimeout(id);
  }, [on, touched, applied, n]);
  const pick = (k: number) => { setTouched(true); setApplied((a) => a.map((v, j) => (j === k ? !v : v))); };
  const score = BASE_SCORE + FIXES.reduce((t, f, k) => t + (applied[k] ? f.gain : 0), 0);
  const lit = ["A", ...FIXES.filter((_, k) => applied[k]).map((f) => f.letter)];
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
                    {applied[0] && <mark className="cd-add">Customers waited two days for a reply and our rating had dropped to 3.8. </mark>}
                    {applied[1] ? <mark className="cd-add">I set up saved replies and sorted tickets by urgency each morning.</mark> : "I worked on our support team and made replies faster."}
                    {applied[2] && <mark className="cd-add"> Replies now take 6 hours instead of 48, and our rating rose to 4.5.</mark>}
                  </p>
                  <p className="ia-sz" aria-hidden="true">{FULL_ANSWER}</p>
                </div>
                <div className="ia-foot">
                  <ul className="cd-star" aria-label="Which parts your answer has">
                    {[["S", "The problem"], ["T", "Your job"], ["A", "What you did"], ["R", "The result"]].map(([l, w]) => <li key={l} className={lit.includes(l) ? undefined : "miss"}>{w}</li>)}
                  </ul>
                  <div className="ia-score"><b key={score}>{score}</b><span>out of 100</span></div>
                </div>
                <div className="ia-meter" aria-hidden="true"><i style={{ width: `${score}%` }} /></div>
              </div>
            </Win>
          </Skel>
          <div className="ia-fixes">
            <ol>
              {FIXES.map((f, k) => {
                const done = applied[k];
                return (
                  <li key={f.title}>
                    <button type="button" className={`ia-fix${done ? " done" : ""}`} aria-pressed={done} onClick={() => pick(k)}>
                      <span className="ia-n" aria-hidden="true">{done ? <Check size={16} strokeWidth={2.5} /> : k + 1}</span>
                      <span className="ia-t"><b>{f.title}</b><span>{f.body}</span></span>
                      <em>+{f.gain} points</em>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button type="button" className={`ia-reset${n === 0 ? " off" : ""}`} disabled={n === 0} onClick={() => { setTouched(true); setApplied(FIXES.map(() => false)); }}>Start over</button>
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

function HowPanel({ i, on }: { i: number; on: boolean }) {
  if (i === 0) return (
    <div className={`hi-p${on ? " on" : ""}`} aria-hidden={!on}>
      <p className="hi-q">Tell me about a time you improved something.</p>
      <div className="hi-wave" aria-hidden="true">{[8, 16, 11, 24, 14, 28, 10, 20, 26, 12, 22, 9, 18, 13, 25, 11, 17, 8].map((h, k) => <i key={k} style={{ height: h, ["--d" as string]: `${k * 60}ms` }} />)}</div>
      <p className="hi-hint"><Mic size={16} strokeWidth={1.75} aria-hidden="true" />Listening to your answer</p>
    </div>
  );
  if (i === 1) return (
    <div className={`hi-p${on ? " on" : ""}`} aria-hidden={!on}>
      <div className="hi-sc">
        <div><small>First try</small><b>64</b></div>
        <ArrowRight size={22} strokeWidth={1.75} aria-hidden="true" />
        <div><small>Second try</small><b className="up">86</b></div>
      </div>
      <ul className="hi-tips">
        <li><Check size={16} strokeWidth={2.25} aria-hidden="true" />Say what changed, with a number.</li>
        <li><Check size={16} strokeWidth={2.25} aria-hidden="true" />Cut filler words like "um" and "like".</li>
      </ul>
    </div>
  );
  return (
    <div className={`hi-p${on ? " on" : ""}`} aria-hidden={!on}>
      <p className="hi-q">Who can see what</p>
      <ul className="hi-vis">
        <li><span>Your verified skills</span><em className="on">Recruiters can see</em></li>
        <li><span>Your name and contact</span><em>Hidden until you say yes</em></li>
      </ul>
      <p className="hi-hint"><Lock size={16} strokeWidth={1.75} aria-hidden="true" />You decide, every time.</p>
    </div>
  );
}

function HowItWorks() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [cur, setCur] = useState(0);
  const [auto, setAuto] = useState(true);
  const play = on && auto && !reduced();
  return (
    <Sec id="how" kicker="How it works" title={<>Practise, improve, <b>get shortlisted</b>.</>}>
      <div className="hi" ref={ref}>
        <div className="hi-tabs" role="tablist" aria-label="How HireStepX works">
          {HOW.map((x, i) => (
            <button key={x.t} type="button" role="tab" id={`hi-t${i}`} aria-selected={cur === i} aria-controls="hi-panel" tabIndex={cur === i ? 0 : -1} className={`hi-tab${cur === i ? " on" : ""}`} onClick={() => { setAuto(false); setCur(i); }}>
              <span className="hi-num" aria-hidden="true">{i + 1}</span>
              <b>{x.t}</b>
              <span className="hi-d">{x.d}</span>
              <i className="hi-bar" aria-hidden="true">{cur === i && <u className={play ? "run" : "full"} onAnimationEnd={() => setCur((v) => (v + 1) % HOW.length)} />}</i>
            </button>
          ))}
        </div>
        <Skel className="hi-stage hx-stage-warm">
          <div id="hi-panel" role="tabpanel" aria-labelledby={`hi-t${cur}`}>
            <Win left={["Sample round", "Your score", "Your privacy"][cur]} alt={undefined}>
              <div className="hi-stack">{HOW.map((_, i) => <HowPanel key={i} i={i} on={cur === i} />)}</div>
            </Win>
          </div>
        </Skel>
      </div>
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
