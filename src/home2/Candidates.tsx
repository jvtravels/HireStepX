"use client";
import { useEffect, useRef, useState } from "react";
import { CandFaq } from "./Extra";
import { Arrow, Close, Dim, Shell, Win } from "./Pages";
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
    <section className="cx-hero">
      <div ref={ref} className={`hx-wrap cx-hero-in hx-rv${on ? " on" : ""}`}>
        <div className="cx-copy">
          <span className="hx-kicker hx-ri" style={delay(0)}>Mock interviews for Indian job seekers</span>
          <h1 className="cx-h1 hx-ri" style={delay(1)}>Say it out loud. Fix the sentence that <b>costs you</b>.</h1>
          <p className="cx-lede hx-ri" style={delay(2)}>Answer real questions by voice for your role and target company. Each answer is scored on STAR, and you hear what to say instead.</p>
          <div className="cx-cta hx-ri" style={delay(3)}>
            <a data-no-underline className="hx-btn lg" href="/signup">Practise free <Arrow /></a>
            <a data-no-underline className="cx-ghost" href="#rewrite">See an answer improve</a>
          </div>
          <ul className="cx-facts hx-ri" style={delay(4)}>
            <li><b>2</b> free sessions</li>
            <li><b>UPI</b> for more</li>
            <li><b>No</b> card needed</li>
          </ul>
        </div>
        <div className="hx-stage cx-demo hx-ri" style={delay(2)}><HeroCoach /></div>
      </div>
    </section>
  );
}

/* ── The rewrite: one answer, four passes ── */

type Pass = { kicker: string; title: string; body: string; score: number; lit: string[] };

const PASSES: Pass[] = [
  { kicker: "Pass 1", title: "Say it the way it comes out", body: "Most first answers describe the work and stop. It reads fine to you because you were there.", score: 58, lit: ["A"] },
  { kicker: "Pass 2", title: "Give the listener the situation", body: "One sentence on why it mattered. Interviewers cannot score a problem they were never told about.", score: 70, lit: ["S", "A"] },
  { kicker: "Pass 3", title: "Say what you did, not what we did", body: "Swap the team for yourself. The specific action is the part they write down.", score: 81, lit: ["S", "T", "A"] },
  { kicker: "Pass 4", title: "Finish on a number", body: "A result with a figure is what gets repeated in the debrief. Land on it, then stop talking.", score: 91, lit: ["S", "T", "A", "R"] },
];

function RewriteStory() {
  const [at, setAt] = useState(0);
  const steps = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.i)); }),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const P = PASSES[at];
  return (
    <section className="pg-sec pg-band rw" id="rewrite">
      <div className="hx-wrap">
        <div className="em-head">
          <span className="hx-kicker">One answer, four passes</span>
          <h2 className="hx-h2">Watch a 58 become a 91 without changing the story.</h2>
          <p>Same project, same person. Only what they said out loud changes.</p>
        </div>
        <div className="rw-grid">
          <ol className="rw-steps">
            {PASSES.map((p, i) => (
              <li key={p.kicker} ref={(el) => { steps.current[i] = el; }} data-i={i} className={`rw-step${i === at ? " on" : ""}`}>
                <span className="rw-k">{p.kicker}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ol>
          <div className="rw-pane hx-stage-warm">
            <Win left="Your answer" right={`Pass ${at + 1} of 4`} alt="An interview answer being rewritten in four passes while its score rises">
              <div className="rw-card">
                <p className="rw-q">Tell me about a time you made something faster.</p>
                <p className="rw-a" aria-live="polite">
                  {at >= 1 && <mark className="cd-add">Checkout was losing one in five buyers on slow phones, and I was asked to fix it. </mark>}
                  {at >= 2 ? <mark className="cd-add">I moved the payment step to load on demand and cut two third-party scripts.</mark> : "I worked on our checkout page and made it load faster."}
                  {at >= 3 && <mark className="cd-add"> Load time fell from 3.4s to 1.9s and completed orders rose 6% the next month.</mark>}
                </p>
                <div className="rw-foot">
                  <ul className="cd-star" aria-label="STAR parts present">
                    {["S", "T", "A", "R"].map((l) => <li key={l} className={P.lit.includes(l) ? undefined : "miss"}>{l}</li>)}
                  </ul>
                  <div className="rw-score"><b key={P.score}>{P.score}</b><span>/ 100</span></div>
                </div>
                <div className="rw-meter" aria-hidden="true"><i style={{ width: `${P.score}%` }} /></div>
              </div>
            </Win>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Aim it at the job ── */

type Aim = { role: string; qs: string[]; co: Record<string, string> };
const COMPANY_KINDS = ["Product startup", "IT services", "Bank"] as const;
const AIMS: Aim[] = [
  { role: "Software engineer", qs: ["Walk me through a bug you chased for more than a day.", "How would you design a rate limiter for an API?", "Tell me about code you wish you had written differently."], co: { "Product startup": "Ownership. Did you decide, or did you wait to be told?", "IT services": "Fundamentals and how you work in a client team.", "Bank": "Care with data, testing and change control." } },
  { role: "Product manager", qs: ["How did you decide what not to build?", "A metric dropped 8% overnight. What do you do first?", "Describe a launch that did not go to plan."], co: { "Product startup": "Speed of judgement with half the data.", "IT services": "Managing scope and a client who changes it.", "Bank": "Risk, compliance and stakeholder sign-off." } },
  { role: "Data analyst", qs: ["Tell me about an insight that changed a decision.", "How do you check a number you do not trust?", "Explain a regression to a sales manager."], co: { "Product startup": "Whether you go from question to answer alone.", "IT services": "Clear reporting and clean hand-offs.", "Bank": "Accuracy, audit trail and definitions." } },
  { role: "Sales", qs: ["Walk me through how you closed your hardest deal.", "A prospect says your price is too high. Now what?", "How do you plan your first week in a territory?"], co: { "Product startup": "Self-starting pipeline, not just closing.", "IT services": "Long cycles and relationship depth.", "Bank": "Trust, compliance and cross-selling with care." } },
];

function AimIt() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [ri, setRi] = useState(0);
  const [kind, setKind] = useState<(typeof COMPANY_KINDS)[number]>("Product startup");
  const A = AIMS[ri];
  return (
    <section className="pg-sec pg-band" id="aim">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head hx-ri" style={delay(0)}>
          <span className="hx-kicker">Aimed at the job</span>
          <h2 className="hx-h2">The questions change with the role and the company.</h2>
        </div>
        <div className="tg hx-ri" style={delay(1)}>
          <div className="tg-ctl">
            <h3 id="tg-role">Role</h3>
            <div className="hv-chips" role="group" aria-labelledby="tg-role">
              {AIMS.map((a, i) => <button key={a.role} type="button" className="jr-chip" aria-pressed={ri === i} onClick={() => setRi(i)}>{a.role}</button>)}
            </div>
            <h3 id="tg-co">Company</h3>
            <div className="hv-chips" role="group" aria-labelledby="tg-co">
              {COMPANY_KINDS.map((k) => <button key={k} type="button" className="jr-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
            </div>
          </div>
          <div className="tg-out" key={`${ri}-${kind}`}>
            <h3>Questions you could get</h3>
            <ol>{A.qs.map((q) => <li key={q}>{q}</li>)}</ol>
            <p className="tg-listen"><span>What a {kind.toLowerCase()} listens for</span>{A.co[kind]}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Remembering what you practised ── */

const WITHOUT = [100, 62, 44, 33, 27, 23, 20];
const WITH = [100, 62, 44, 100, 70, 52, 100];
const DAYS = ["Day 1", "2", "3", "4", "5", "6", "7"];

function Memory() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="pg-sec" id="memory">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head ctr hx-ri" style={delay(0)}>
          <span className="hx-kicker">Why it sticks</span>
          <h2 className="hx-h2">You forget most of what you practised within a week.</h2>
          <p>We track the skills you were weakest on and nudge you to say them again just before they fade.</p>
        </div>
        <div className="mm hx-ri" style={delay(1)} role="img" aria-label="Chart: without a reminder, recall of a practised answer falls to about 20 percent by day seven; with reminders on days four and seven it resets to full.">
          <div className="mm-key"><span><i className="a" />Practise once</span><span><i className="b" />Reminded on days 4 and 7</span></div>
          <div className="mm-cols">
            {DAYS.map((day, i) => (
              <div className="mm-col" key={day}>
                <div className="mm-bars">
                  <i className="a" style={{ height: `${on ? WITHOUT[i] : 0}%`, transitionDelay: `${i * 60}ms` }} />
                  <i className="b" style={{ height: `${on ? WITH[i] : 0}%`, transitionDelay: `${i * 60 + 30}ms` }} />
                </div>
                <span>{day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Who sees what ── */

const TRUST: [string, string][] = [
  ["Employers see a code, not your name", "Until you say yes, your profile reads “Candidate #…” with no contact details or links."],
  ["Discovery is a switch", "Turn it on when you want to be found. Turn it off and you drop out of every search."],
  ["Delete it whenever you like", "Your data, your call. Access, correct or erase it under India's DPDP Act."],
];

function TrustStrip() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="pg-sec tr" id="privacy">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="tr-row">
          {TRUST.map(([t, b], i) => (
            <div key={t} className="tr-item hx-ri" style={delay(i)}>
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
        <div className="em-head ctr hx-ri" style={delay(0)}>
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
      <RewriteStory />
      <AimIt />
      <Memory />
      <TrustStrip />
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
