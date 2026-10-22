"use client";
import { useEffect, useRef, useState } from "react";
import { ScoreChip } from "../employer/_atoms";
import { CandFaq } from "./Extra";
import { Arrow, Close, Cursor, Dim, Features, HowItWorks, Lock, Mic, Shell, SkillBars, Summary, Win, d, type FeatureTab } from "./Pages";
import { delay, reduced, useReveal } from "./motion";

/* ── Hero: answer, see the gap, fix it ── */

type Round = { q: string; base: string; add: string; miss: string; before: number; after: number; dims: [string, number, number][]; tip: string };

const ROUNDS: Round[] = [
  {
    q: "Tell me about a time you made something faster.",
    base: "I worked on checkout. It was slow, so I changed how we loaded the payment step and it felt a lot better after.",
    add: " Checkout time fell from 1.8s to 1.1s, and held through both sale weekends.",
    miss: "R",
    before: 64,
    after: 86,
    dims: [["Clarity", 70, 84], ["Relevance", 72, 88], ["Depth", 52, 82], ["Confidence", 66, 80]],
    tip: "Result is missing. Say what changed, with a number.",
  },
  {
    q: "Tell me about a disagreement with a teammate.",
    base: "We disagreed on when to ship. I showed them the failing tests and we shipped on Monday instead of Friday.",
    add: " I owned the release, so the call was mine to defend, and I wrote up the risk for the team.",
    miss: "T",
    before: 61,
    after: 84,
    dims: [["Clarity", 68, 82], ["Relevance", 70, 86], ["Depth", 50, 80], ["Confidence", 62, 78]],
    tip: "Task is missing. Say what you were responsible for.",
  },
];

type Phase = "speak" | "score" | "scored" | "fix" | "fixed";

function HeroCoach() {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("speak");
  const [n, setN] = useState(0);
  const [m, setM] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const ids = useRef<ReturnType<typeof setTimeout>[]>([]);
  const R = ROUNDS[round];
  const later = (fn: () => void, ms: number) => { ids.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    setPhase("speak"); setN(0); setM(0);
    if (reduced()) { setN(R.base.length); setPhase("scored"); return; }
    let tick: ReturnType<typeof setInterval> | undefined;
    later(() => {
      let i = 0;
      tick = setInterval(() => {
        i += 1;
        setN(i);
        if (i < R.base.length) return;
        clearInterval(tick);
        later(() => { setPhase("score"); later(() => setPhase("scored"), 1000); }, 450);
      }, 24);
    }, 800);
    return () => { clearInterval(tick); ids.current.forEach(clearTimeout); ids.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
  }, [n, m, phase]);

  const fix = () => {
    if (phase !== "scored") return;
    if (reduced()) { setM(R.add.length); setPhase("fixed"); return; }
    setPhase("fix");
    let i = 0;
    const tick = setInterval(() => {
      i += 1;
      setM(i);
      if (i < R.add.length) return;
      clearInterval(tick);
      later(() => setPhase("fixed"), 500);
    }, 22);
  };

  const fixed = phase === "fixed";
  const showRes = phase === "scored" || phase === "fix" || phase === "fixed";
  const score = fixed ? R.after : R.before;
  const last = round === ROUNDS.length - 1;

  return (
    <div className="hc cd">
      <div className="hc-body">
        <div className="hc-log" ref={log} role="log" aria-live="polite">
          <div className="hc-m us"><span className="hc-x" aria-hidden="true">X</span><div className="hc-b">{R.q}</div></div>
          {n > 0 && (
            <div className="hc-m you">
              <div className={`hc-b${phase === "speak" || phase === "fix" ? " hc-caret" : ""}`}>
                {R.base.slice(0, n)}
                {m > 0 && <mark className="cd-add">{R.add.slice(0, m)}</mark>}
              </div>
            </div>
          )}
          {phase === "score" && <div className="hc-m us" aria-hidden="true"><span className="hc-x">X</span><div className="hc-b hc-dots"><span /><span /><span /></div></div>}
        </div>
        <div className="hc-res">
          {showRes ? (
            <div key={`${round}-${fixed}`} className="cd-res">
              <div className="hc-top">
                <ul className="cd-star" aria-label="STAR breakdown">
                  {["S", "T", "A", "R"].map((l) => <li key={l} className={!fixed && l === R.miss ? "miss" : undefined}>{l}</li>)}
                </ul>
                <span>Answer score</span>
              </div>
              <div className="cd-score"><b>{score}</b><span>out of 100</span></div>
              <Dim items={R.dims.map(([k, a, b]): [string, number] => [k, fixed ? b : a])} />
              <p className="cd-tip">{fixed ? "Every part of STAR is there." : R.tip}</p>
            </div>
          ) : (
            <p className="hc-wait">{phase === "score" ? "Scoring your answer." : "Your score shows up here."}</p>
          )}
        </div>
      </div>
      <div className="hc-foot">
        {phase === "scored" && <><span className="hc-hint">Try it</span><button type="button" className="hc-chip" onClick={fix}>Add the {R.miss === "R" ? "result" : "task"}</button></>}
        {fixed && !last && <button type="button" className="hc-chip" onClick={() => setRound((r) => r + 1)}>Try another question</button>}
        {fixed && last && <button type="button" className="hc-chip" onClick={() => setRound(0)}>Play it again</button>}
      </div>
    </div>
  );
}

function CandHero() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="hx-hero">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <h1 className="hx-h1">Practise the interview out loud. Fix the one sentence that <b>costs you</b>.</h1>
        <p className="hx-lede">Pick your role, upload your resume and answer real questions by voice. Every answer is scored on STAR, and you see exactly what to say instead. Your first two sessions are free.</p>
        <div className="hx-cta">
          <a data-no-underline className="hx-btn lg" href="/signup">Practise free <Arrow /></a>
        </div>
        <div className="hx-stage pg-hero-stage hx-ri" style={delay(2)}><HeroCoach /></div>
      </div>
    </section>
  );
}

/* ── How it works ── */

const STEPS: [string, string][] = [
  ["Set up", "Choose a role, your experience and the company you want. Upload your resume as a PDF or paste it in."],
  ["Practise", "A voice asks and you answer out loud. Your words appear as you speak. No typing, no multiple choice."],
  ["Review", "Each answer is marked on STAR and scored on clarity, relevance, depth and confidence."],
  ["Fix", "Read the stronger version, say it again, and watch the score move."],
  ["Get found", "Switch on discovery and employers find you by role and score. They see a code, never your name."],
];

const STEP_ICONS: React.ReactNode[] = [
  <g key="1"><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></g>,
  <g key="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></g>,
  <path key="3" d="M4 7h10M4 12h14M4 17h7" />,
  <g key="4"><path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></g>,
  <g key="5"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></g>,
];

const DIMS: [string, number][] = [["Clarity", 80], ["Relevance", 76], ["Depth", 64], ["Confidence", 70]];

function StepScene({ n }: { n: number }) {
  if (n === 0) return (
    <Win left="New interview" right="Step 1 of 2" alt="Setting up an interview: a role, a company and a resume that is read for skills">
      <div className="pg-body">
        <div className="pg-two">
          <div className="pg-field"><span>Role</span><div className="pg-input"><span className="hs-type" style={d(0.3)}>Backend Engineer</span></div></div>
          <div className="pg-field"><span>Experience</span><div className="pg-input hs-in" style={d(1.5)}>3 years</div></div>
        </div>
        <div className="pg-field hs-in" style={d(2)}><span>Company you are aiming at</span><div className="pg-input">Product company, Bengaluru</div></div>
        <div className="pg-field hs-in" style={d(2.6)}>
          <span>Resume</span>
          <div className="pg-file">
            <span className="hx-pv-doc" aria-hidden="true"><i /><i /><i /></span>
            <div>priya_resume.pdf<div className="pg-tags" style={{ marginTop: 8 }}>{["Node.js", "PostgreSQL", "Redis"].map((s, i) => <span key={s} className="pg-tag on hs-pop" style={d(3.2 + i * 0.25)}>{s}</span>)}</div></div>
            <em>Read</em>
          </div>
        </div>
        <div className="hs-swap hs-act">
          <span className="hx-fakebtn hs-press hs-gone" style={d(4.4)}>Start interview</span>
          <Cursor press={4.4} />
          <span className="hs-ok hs-in" style={d(5.1)}>Ready. Question 1 is next.</span>
        </div>
      </div>
    </Win>
  );
  if (n === 1) return (
    <Win left="Mock interview / Backend Engineer" right="Q3 of 6" alt="A spoken interview question with your answer written out as you speak">
      <div className="pg-body">
        <ol className="hx-prog" style={{ display: "flex" }} aria-label="Question 3 of 6">{[0, 1, 2, 3, 4, 5].map((i) => <li key={i} className={i < 2 ? "done" : i === 2 ? "now" : undefined} />)}</ol>
        <h3 className="pg-q hs-in" style={d(0.2)}>Tell me about a time you made something faster.</h3>
        <div className="hs-in" style={d(1)}><Mic /></div>
        <p className="pg-tx hs-in" style={d(1.6)}><i>0:31</i>&nbsp; We timed checkout on the UPI path before and after, and watched it for two sale weekends</p>
        <p className="hs-note hs-in" style={d(2.6)}>Answer out loud. Nothing to type.</p>
      </div>
    </Win>
  );
  if (n === 2) return (
    <Win left="Session report / Question 3 of 6" right="Answer score 72" alt="An answer marked on STAR and scored on four dimensions">
      <div className="pg-body">
        <div className="hs-h"><b>STAR</b><span className="hs-count hs-pop" style={d(1.6)}>Result missing</span></div>
        <ul className="cd-star cd-star-lg">{["S", "T", "A", "R"].map((l, i) => <li key={l} className={`hs-pop${l === "R" ? " miss" : ""}`} style={d(0.2 + i * 0.25)}>{l}</li>)}</ul>
        <SkillBars rows={DIMS} start={1} />
        <Summary at={3}>Clear on what you did. Say how you knew it worked, with a number.</Summary>
      </div>
    </Win>
  );
  if (n === 3) return (
    <Win left="Session report / Question 3 of 6" right="72 to 86" alt="An answer beside a stronger version with the result added">
      <div className="pg-body">
        <div className="pg-ans">
          <div>
            <h4><span>You said</span><span>R missing</span></h4>
            <p>We made it <mark>a lot</mark> better after the change.</p>
          </div>
          <div className="better hs-side" style={d(0.8)}>
            <h4><span>Try saying</span><span>+14 points</span></h4>
            <p>We made it better. <ins>Checkout time fell from 1.8s to 1.1s, and stayed there through both sales.</ins></p>
          </div>
        </div>
        <div className="hs-swap hs-act">
          <span className="hx-fakebtn hs-press hs-gone" style={d(2.4)}>Practise this again</span>
          <Cursor press={2.4} />
          <span className="hs-ok hs-in" style={d(3.1)}>Score 72 to 86. Result is there now.</span>
        </div>
      </div>
    </Win>
  );
  return (
    <Win left="Settings / Discovery" right="Sample" alt="A profile switch that lets employers find you by a masked code">
      <div className="pg-body">
        <div className="hs-h"><b>Let employers find me</b><span className="hs-count hs-pop" style={d(0.4)}>On</span></div>
        <div className="pg-who hs-in" style={d(0.8)}><span className="hx-vis-av">4F</span><div><b>Candidate 4F2K</b><span>Backend Engineer, Bengaluru</span></div><span className="sc"><ScoreChip score={82} /></span></div>
        <div className="pg-lockrow hs-in" style={d(1.4)}>{["Name", "Phone", "Email"].map((f) => <span key={f}><Lock />{f}</span>)}</div>
        <p className="hs-note hs-in" style={d(2.2)}>Employers see a code and your scores. Turn it off and you vanish from search.</p>
      </div>
    </Win>
  );
}

/* ── Why ── */

const THOUGHTS = ["It sounded fine in my head", "My friend said it was good", "I will just wing it"];
const DIFFS = ["Scored on STAR, not on vibes", "Told what to say instead", "Reminded before it fades"];
const DIFF_ICONS: React.ReactNode[] = [
  <g key="a"><circle cx="12" cy="12" r="8" /><path d="M9 12.5l2.2 2.2L15.5 10" /></g>,
  <path key="b" d="M4 5h16v11H9l-5 4z" />,
  <g key="c"><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.5" /></g>,
];

function WhyPractice() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="pg-sec pg-band">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head ctr hx-ri" style={delay(0)}>
          <span className="hx-kicker">Why HireStepX</span>
          <h2 className="hx-h2">Rehearsing in your head tells you nothing. Answering out loud does.</h2>
        </div>
        <div className="wy hx-ri" style={delay(1)}>
          <div className="wy-claim">
            <span className="wy-tag">Practising alone</span>
            <ul>{THOUGHTS.map((c) => <li key={c}>{c}</li>)}</ul>
            <p>Feels like preparation. Nothing here to check.</p>
          </div>
          <div className="wy-proof">
            <div className="wy-top">
              <span className="wy-tag on">In your report</span>
              <span className="wy-sample">Sample</span>
            </div>
            <div className="wy-who">
              <span className="wy-id" aria-hidden="true">Q3</span>
              <div><b>Tell me about a time you made something faster</b><span>Backend Engineer</span></div>
            </div>
            <p className="wy-q">&ldquo;We made checkout <mark>a lot better</mark> after the change.&rdquo;</p>
            <div className="wy-skill"><span>Result is missing. Say what changed, with a number.</span><ScoreChip score={72} /></div>
          </div>
        </div>
        <div className="wy-diff hx-ri" style={delay(2)}>
          {DIFFS.map((t, i) => <h3 key={t}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{DIFF_ICONS[i]}</svg>{t}</h3>)}
        </div>
      </div>
    </section>
  );
}

/* ── Pinned features ── */

function InterviewView() {
  return (
    <Win left="Mock interview / Backend Engineer" right="Q3 of 6" alt="A spoken interview question with a live transcript">
      <div className="pg-body">
        <ol className="hx-prog" style={{ display: "flex" }} aria-label="Question 3 of 6">{[0, 1, 2, 3, 4, 5].map((i) => <li key={i} className={i < 2 ? "done" : i === 2 ? "now" : undefined} />)}</ol>
        <h3 className="pg-q">Tell me about a time you made something faster.</h3>
        <Mic />
        <p className="pg-tx"><i>0:31</i>&nbsp; We timed checkout on the UPI path before and after, and watched it for two sale weekends</p>
      </div>
    </Win>
  );
}

function ReportView() {
  return (
    <Win left="Session report / Question 3 of 6" right="Answer score 72" alt="An answer beside a coached version, with four scores">
      <div className="pg-body">
        <div className="pg-ans">
          <div>
            <h4><span>You said</span><span>R missing</span></h4>
            <p>We made it <mark>a lot</mark> better after the change.</p>
          </div>
          <div className="better">
            <h4><span>Try saying</span><span>+14 points</span></h4>
            <p>We made it better. <ins>Checkout time fell from 1.8s to 1.1s, and stayed there through both sales.</ins></p>
          </div>
        </div>
        <Dim items={[["Clarity", 80], ["Relevance", 76], ["Depth", 64], ["Confidence", 70]]} />
      </div>
    </Win>
  );
}

function SkillsView() {
  const rows: [string, number, string, boolean][] = [
    ["System design", 38, "Practise today", true],
    ["Conflict stories", 66, "In 5 days", false],
    ["Communication", 88, "Going well", false],
  ];
  return (
    <Win left="Your skills" right="Updated after every session" alt="Three skills with a strength bar and a next-practice date">
      <div className="pg-body pg-decay">
        <ul>
          {rows.map(([n, v, t, due]) => (
            <li key={n}>
              <span>{n}</span>
              <div className="pg-fade" aria-label={`${n} strength ${v} percent`}><i className={due ? "due" : undefined} style={{ width: `${v}%` }} /><u style={{ left: "46%" }} /></div>
              <em className={due ? "due" : undefined}>{t}</em>
            </li>
          ))}
        </ul>
        <div className="pg-ctl"><span>The line marks where a skill starts to fade.</span></div>
      </div>
    </Win>
  );
}

function FoundView({ alt }: { alt: boolean }) {
  return (
    <div className="pg-seen">
      <div className={alt ? "off" : undefined}>
        {alt ? <><h4>Discovery off</h4><p>You do not appear in any employer search.</p></> : (
          <>
            <h4>Discovery on</h4>
            <div className="pg-who"><span className="hx-vis-av">4F</span><div><b>Candidate 4F2K</b><span>Backend Engineer, Bengaluru</span></div><span className="sc"><ScoreChip score={82} /></span></div>
            <div className="pg-lockrow">{["Name", "Phone", "Email"].map((f) => <span key={f}><Lock />{f}</span>)}</div>
          </>
        )}
      </div>
      <div className="cd-cmp">
        <h4>Employers can see</h4>
        <ul>{["Role and city", "Skill scores", "Practice history"].map((x) => <li key={x}>{x}</li>)}</ul>
        <h4>Always hidden</h4>
        <ul className="no">{["Name", "Phone", "Email"].map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    </div>
  );
}

const TABS: FeatureTab[] = [
  {
    name: "Interview",
    title: "Real questions, asked out loud.",
    body: "Questions come from your resume, your role and the company you name. A voice asks, listens, and writes your words as you speak.",
    points: ["Six questions per session", "A PDF or text resume", "Pause and finish when you like"],
    view: () => <InterviewView />,
  },
  {
    name: "Report",
    title: "The sentence that cost you, marked.",
    body: "Every answer is scored on STAR, then on clarity, relevance, depth and confidence. A coached version shows what stronger sounds like.",
    points: ["A STAR breakdown per answer", "A model answer to compare", "Practise the same question again"],
    view: () => <ReportView />,
  },
  {
    name: "Skills",
    title: "Practise again before it fades.",
    body: "Skills slip when you stop using them. Each one gets a strength and a next-practice date, starting with your weakest.",
    view: () => <SkillsView />,
  },
  {
    name: "Get found",
    title: "Employers find you. You decide.",
    body: "Discovery is on by default and your identity stays masked. One switch in Settings takes you out of search, and you can delete your account any time.",
    view: (alt) => <FoundView alt={alt} />,
  },
];

const TAB_ICONS: React.ReactNode[] = [
  <g key="i"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></g>,
  <path key="r" d="M4 6h16M4 12h11M4 18h6" />,
  <path key="s" d="M4 18l5-6 4 3 7-9" />,
  <g key="g"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></g>,
];

/* ── Pricing ── */

const FREE_LIST = ["Two full interview sessions", "A scored report for every answer", "Your profile, with discovery on or off"];
const COUNTS = [3, 5, 8, 12];
const FREE_SESSIONS = 2;

function plan(sessions: number) {
  const extra = Math.max(0, sessions - FREE_SESSIONS);
  let best = { packs: 0, singles: extra, cost: extra * 9 };
  for (let packs = 1; packs <= Math.ceil(extra / 5); packs++) {
    const singles = Math.max(0, extra - packs * 5);
    const cost = packs * 39 + singles * 9;
    if (cost < best.cost) best = { packs, singles, cost };
  }
  return best;
}

function CandPricing() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [count, setCount] = useState(5);
  const p = plan(count);
  const lines: [string, string][] = [
    [`Free sessions x ${Math.min(count, FREE_SESSIONS)}`, "₹0"],
    ...(p.packs ? [[`Sprint Pack x ${p.packs}`, `₹${p.packs * 39}`] as [string, string]] : []),
    ...(p.singles ? [[`Single sessions x ${p.singles}`, `₹${p.singles * 9}`] as [string, string]] : []),
  ];
  return (
    <section className="pg-sec pg-band" id="pricing">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head hx-ri" style={delay(0)}>
          <span className="hx-kicker">Pricing</span>
          <h2 className="hx-h2">Two sessions free. Then pay only as you practise.</h2>
        </div>
        <div className="pc">
          <div className="pc-l hx-ri" style={delay(1)}>
            <div className="pl-grp">
              <h3><span>Free</span></h3>
              <ul>{FREE_LIST.map((f) => <li key={f}><i />{f}</li>)}</ul>
            </div>
            <div className="pl-grp paid">
              <h3><span>When you want more</span></h3>
              <div className="pl-price">
                <b>₹9</b>
                <p>per session. The credit never expires.<br />Or ₹39 for five sessions, valid 30 days. <a href="/pricing">Full pricing</a></p>
              </div>
              <p className="cd-pay">No subscription. Pay by UPI, card or netbanking.</p>
            </div>
          </div>
          <div className="pc-r hx-ri" style={delay(2)}>
            <div className="pg-stage pc-stage">
              <Win left="Your prep plan" alt="A cost estimate for the number of sessions you pick">
                <div className="cd-plan">
                  <h4 id="cd-count">How many sessions will you practise?</h4>
                  <div className="hv-chips" role="group" aria-labelledby="cd-count">
                    {COUNTS.map((c) => <button key={c} type="button" className="jr-chip" aria-pressed={count === c} onClick={() => setCount(c)}>{c} sessions</button>)}
                  </div>
                  <ul className="cd-lines" key={count}>
                    {lines.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}
                  </ul>
                  <div className="cd-total"><span>Total</span><b>₹{p.cost}</b></div>
                </div>
                <div className="pg-ctl pc-ctl"><span>{p.cost === 0 ? "All free. No card needed." : `About ₹${(p.cost / count).toFixed(1).replace(/\.0$/, "")} per session, best price picked for you.`}</span><a data-no-underline className="hx-fakebtn pg-press" href="/signup">Start free</a></div>
              </Win>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CandidatesPage() {
  return (
    <Shell active="talent">
      <CandHero />
      <HowItWorks steps={STEPS} icons={STEP_ICONS} scene={(n) => <StepScene n={n} />} title="Five steps from your resume to a better answer." />
      <WhyPractice />
      <Features tabs={TABS} icons={TAB_ICONS} kicker="What you get" title="Everything from first answer to first offer." />
      <CandPricing />
      <CandFaq />
      <Close
        kicker="Ready when you are"
        title={<>Start with <b>one answer</b>.</>}
        body="Practise out loud, see exactly what to fix, and let employers find the proof."
        primary={["Practise free", "/signup"]}
        secondary={["Hire from proof", "/employers"]}
        notes={["2 free sessions", "No card needed", "Delete anytime"]}
      />
    </Shell>
  );
}
