"use client";
import { useEffect, useState } from "react";
import { ScoreChip } from "./Score";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { ScoreGauge } from "./Score";
import { delay, useReveal, useTween } from "./motion";

const SkillTag = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", padding: "4px 9px", borderRadius: 8, background: t.creamSoft, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 12, color: t.inkSoft, fontWeight: 500 }}>{children}</span>
);

const AnonName = ({ id }: { id: string }) => (
  <span style={{ fontFamily: f.sans, fontWeight: 600, color: t.coal, fontSize: 14 }}>Candidate #{id}</span>
);


const ANSWER = "We timed checkout on the UPI path before and after, and watched it for two sale weekends.";
const FIX = "Checkout time fell from 1.8s to 1.1s, and stayed there through both sales.";
const ROW = 60;
const RANK_ROW = 78;
const RANK_GAP = 12;

function Header({ left, right }: { left: string; right: React.ReactNode }) {
  return (
    <header className="hx-ah">
      <span className="hx-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{left}</span>
      <em>{right}</em>
    </header>
  );
}

function Check() {
  return <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

function Avatar({ id }: { id: string }) {
  return <img className="hx-av" src={`/people/${id}.jpg`} alt="" width={32} height={32} />;
}

const Ico = ({ children, size = 16 }: { children: React.ReactNode; size?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CandidateIcon = () => <Ico><circle cx="6.5" cy="5.5" r="2.5" /><path d="M1.8 13.5c0-2.6 2.1-4.5 4.7-4.5s4.7 1.9 4.7 4.5" /><path d="M11.5 3.5a3 3 0 0 1 0 4M13.3 2a5.4 5.4 0 0 1 0 7" /></Ico>;
const EmployerIcon = () => <Ico><path d="M2 3.5h8M2 7.5h4.5M2 11.5h4.5" /><circle cx="11" cy="10" r="2.5" /><path d="M13 12l1.7 1.7" /></Ico>;
const WaveIcon = () => <Ico><path d="M2 8h0M4.5 5v6M7 2.5v11M9.5 5.5v5M12 4v8M14 7v2" /></Ico>;
const LockIcon = () => <Ico size={18}><rect x="3" y="7" width="10" height="7" rx="2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></Ico>;
const PlusIcon = () => <Ico size={18}><circle cx="8" cy="8" r="6.2" /><path d="M8 5.2v5.6M5.2 8h5.6" /></Ico>;
const WarnIcon = () => <Ico size={14}><path d="M8 2.2l6 10.6H2z" /><path d="M8 6.5v3M8 11.2h0" /></Ico>;

export function HeroSurface() {
  const [fixed, setFixed] = useState(false);
  const [contact, setContact] = useState(false);
  const { ref, on } = useReveal<HTMLDivElement>();
  const score = useTween(fixed ? 86 : 72);
  const people = [
    { id: "c92d", s: 78, note: "Strong trade-offs, thin Result" },
    { id: "a41f", s: fixed ? 86 : 72, note: fixed ? "Names the metric and the result" : "Names the metric, no result" },
    { id: "e07b", s: 64, note: "Solid basics, light on ownership" },
    { id: "f19a", s: 59, note: "Clear answers, limited depth" },
  ];
  const rank = [...people].sort((a, b) => b.s - a.s).map((p) => p.id);
  const star: [string, boolean][] = [["S", true], ["T", true], ["A", true], ["R", fixed]];
  return (
    <div className={on ? "hx-hs hv hx-rv on" : "hx-hs hv hx-rv"} ref={ref}>
      <div className="hv-win hx-ri" style={delay(0)}>
        <header className="hv-bar">
          <span className="hv-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="hv-crumb">HireStepX / Mock interview / Backend Engineer</span>
          <span className="hv-samp"><i />Sample, try it</span>
        </header>
        <div className="hv-split">
          <section className="hv-pane" aria-label="Candidate view">
            <p className="hv-ph"><b><CandidateIcon />Candidate view</b><em>Q3 of 6 · 0:42</em></p>
            <ol className="hv-steps" aria-label="Question 3 of 6">{[1, 2, 3, 4, 5, 6].map((n) => <li key={n} className={n === 3 ? "now" : n > 3 ? "rest" : undefined} aria-current={n === 3 ? "step" : undefined}>{n}</li>)}</ol>
            <p className="hv-q">Tell me about a time you made something faster.</p>
            <div className="hv-ans">
              <span className="hv-ats"><WaveIcon />0:31</span>
              <p>
                {fixed ? <>“{ANSWER} <ins key="f">{FIX}</ins>”</> : <>“We timed checkout on the UPI path before and after, and watched it for two sale weekends.” <span className="hv-miss">Result missing</span></>}
              </p>
            </div>
            <ul className="hv-star" aria-label="STAR coverage">
              {star.map(([l, ok]) => <li key={l} className={ok ? "ok" : "miss"}><b>{l}</b><span>{ok ? "Covered" : "Missing"}{ok ? <Check /> : <WarnIcon />}</span></li>)}
            </ul>
            <div className="hv-foot">
              <button type="button" className="hv-fix" aria-pressed={fixed} onClick={() => setFixed((v) => !v)}>
                {fixed ? <Check /> : <PlusIcon />}{fixed ? "Undo the fix" : "Add the missing Result"}
              </button>
              <span className="hv-score">Answer score <b className="hx-num">{score}</b><i>/ 100</i></span>
            </div>
          </section>
          <section className="hv-pane hv-pane-r" aria-label="Employer view">
            <p className="hv-ph"><b><EmployerIcon />Employer view</b><em>Ranked on answers</em></p>
            <ul className="hv-rk" style={{ height: RANK_ROW * people.length - RANK_GAP }} aria-live="polite">
              {people.map((p) => {
                const me = p.id === "a41f";
                return (
                  <li key={p.id} className={me ? (fixed ? "me hit" : "me") : undefined} style={{ transform: `translateY(${rank.indexOf(p.id) * RANK_ROW}px)` }}>
                    <span className="hv-n">{rank.indexOf(p.id) + 1}</span>
                    <span className="hv-tile">#{p.id.slice(0, 2)}</span>
                    <span className="hv-who">
                      <b>{me && contact ? "Priya S." : `Candidate #${p.id}`}{me && !contact && <i aria-hidden="true" />}</b>
                      <em>{p.note}</em>
                    </span>
                    <span className={me ? "hv-sc hv-sc-me" : p.s >= 75 ? "hv-sc hi" : "hv-sc"}>{me ? score : p.s}</span>
                  </li>
                );
              })}
            </ul>
            <div className="hv-unlock">
              <span className="hv-lock"><LockIcon /></span>
              <span className="hv-ut"><b>Rank {rank.indexOf("a41f") + 1} of 4</b><em>Full answers &amp; telemetry</em></span>
              <button type="button" className="hv-btn" aria-pressed={contact} onClick={() => setContact((v) => !v)}>{contact ? "Contact shared" : "Unlock to contact"}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function StepVisual({ n, play }: { n: number; play: boolean }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rec, setRec] = useState(false);
  const [sq, setSq] = useState([false, false, false, false]);
  useEffect(() => {
    if (!play) { setOpen(false); setRevealed(false); setRec(false); setSq([false, false, false, false]); return; }
    const ids: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => { ids.push(setTimeout(fn, ms)); };
    if (n === 0) { at(150, () => setRec(true)); at(1900, () => setRec(false)); }
    if (n === 1) [0, 1, 2].forEach((k) => at(250 + k * 450, () => setSq((a) => a.map((v, j) => (j === k ? true : v)))));
    if (n === 2) at(500, () => setOpen(true));
    if (n === 3) at(700, () => setRevealed(true));
    return () => ids.forEach(clearTimeout);
  }, [play, n]);
  const covered = sq.filter(Boolean).length;
  const score = useTween([0, 24, 48, 72, 86][covered], 600);
  if (n === 0) {
    return (
      <div className="hx-sd" data-rec={rec}>
        <button type="button" className="hx-rec" aria-pressed={rec} onClick={() => setRec((v) => !v)}><i />{rec ? "Recording" : "Tap to record"} <span className="hx-num">0:42</span></button>
        <div className="hx-wv">{[10, 22, 14, 30, 18, 36, 24, 12, 28, 16, 32, 20, 10, 26, 14, 22].map((h, i) => <b key={i} style={{ height: h, ["--d" as string]: `${i * 60}ms` }} />)}</div>
        <p className="hx-cap">Q3 of 6: Tell me about a time you made something faster.</p>
      </div>
    );
  }
  if (n === 1) {
    return (
      <div className="hx-sd">
        <div className="hx-sc"><ScoreChip score={score} /></div>
        <ul className="hx-dm">{(["Clarity", "Relevance", "Depth", "Confidence"] as const).map((l, i) => <li key={l} data-on={sq[i]} className={sq[i] || !play || i < 3 ? "" : "miss"}><button type="button" aria-pressed={sq[i]} aria-label={`${l} ${sq[i] ? "strong" : "needs work"}`} onClick={() => setSq((a) => a.map((v, j) => (j === i ? !v : v)))}><span>{l}</span><i><u /></i></button></li>)}</ul>
      </div>
    );
  }
  if (n === 2) {
    return (
      <div className="hx-sd">
        <button type="button" className="hx-tg" role="switch" aria-checked={open} onClick={() => setOpen((v) => !v)}>
          <span>{open ? "Employers can find me" : "Hidden from search"}</span>
          <i className={open ? "hx-switch on" : "hx-switch"} />
        </button>
        <p className="hx-cap">Your name stays hidden until you share it.</p>
      </div>
    );
  }
  return (
    <div className="hx-sd">
      <div className="hx-uk">
        <span className="hx-who-row"><Avatar id="a41f" /><span className="hx-who"><b>Priya S.</b><span className="hx-num">Backend Engineer</span></span></span>
        <button type="button" className="hx-fakebtn" aria-pressed={revealed} onClick={() => setRevealed((v) => !v)}>{revealed ? "Sent" : "Say hello"}</button>
      </div>
      {revealed ? <p key="r" className="hx-reply hx-swap">Priya: Happy to talk this week.</p> : <p className="hx-cap">Replies show up here.</p>}
    </div>
  );
}

export function ReportSurface() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [fix, setFix] = useState(false);
  const total = useTween(fix ? 86 : 72);
  const skills: [string, number, string][] = [["System design", 64, "Practise in 2 days"], ["Communication", 82, "Going well"], ["Conflict stories", 71, "Practise in 5 days"]];
  return (
    <div className={on ? "hx-hs hx-rs hx-rv on" : "hx-hs hx-rs hx-rv"} ref={ref}>
      <div className="hx-win hx-ri" style={delay(0)}>
        <Header left="Session report / Backend Engineer / Practice 4" right="18 Oct · 12 min" />
        <div className="hx-rep">
          <div className="hx-rep-l">
            <ScoreGauge score={total} color="oklch(0.359 0.135 278.697)" />
            <ul className="hx-sr hx-sr-col">
              {([["Situation", true], ["Task", true], ["Action", true], ["Result", fix]] as const).map(([n, ok]) => <li key={n} className={ok ? "ok" : "miss"}><b>{n[0]}</b>{n}<span>{ok ? "Covered" : "Missing"}</span></li>)}
            </ul>
          </div>
          <div className="hx-rep-r">
            <p className="hx-pl"><span>Question 3 of 6</span><em>Your answer · 0:31</em></p>
            <h3 className="hx-pq">You made checkout 40% faster. How did you know?</h3>
            <p className="hx-tx hx-tx-lg">
              {fix ? <ins>{FIX}</ins> : <>We made it <mark>a lot</mark> better after the change. <span className="hx-miss">Result missing</span></>}
            </p>
            <button type="button" className="hx-fix hx-fix-q alt" aria-pressed={fix} onClick={() => setFix((v) => !v)}>{fix ? "Show my answer" : "See a stronger answer"}</button>
            <ul className="hx-bars">
              {skills.map(([n, v, d]) => (
                <li key={n}><span>{n}</span><div className="hx-bar"><i style={{ width: on ? `${v}%` : 0 }} /></div><b className="hx-num">{v}</b><em>{d}</em></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="hx-float hx-fl-c hx-ri" style={delay(3)}>
        <span>Try saying</span>
        <p>{FIX}</p>
        <div className="hx-fl-row">
          <button type="button" className="hx-fakebtn" aria-pressed={fix} onClick={() => setFix((v) => !v)}>{fix ? "Undo" : "Apply to my answer"}</button>
          <span className="hx-num hx-gain">+14 points</span>
        </div>
      </div>
    </div>
  );
}

const CANDS: { id: string; s: number; role: string; a: string; t: [string, boolean][] }[] = [
  { id: "a41f", s: 86, role: "Bengaluru", a: FIX, t: [["Gives a number", true], ["Shows the result", true]] },
  { id: "c92d", s: 78, role: "Bengaluru", a: "Moved reads to a replica and cached the hot path. I did not measure the end result.", t: [["Clear trade-offs", true], ["No result given", false]] },
  { id: "e07b", s: 64, role: "Pune", a: "Split the monolith into two services over a quarter.", t: [["Good basics", true], ["Little ownership", false]] },
  { id: "f19a", s: 59, role: "Hyderabad", a: "Added indexes and the pages loaded faster.", t: [["Clear steps", true], ["No numbers", false]] },
  { id: "b73c", s: 55, role: "Chennai", a: "Rewrote the report job so it runs overnight instead of on request.", t: [["Practical fix", true], ["No numbers", false]] },
  { id: "d28e", s: 52, role: "Delhi", a: "Used a queue so the API stopped timing out.", t: [["Right tool chosen", true], ["No numbers", false]] },
];

export function InboxSurface() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [sel, setSel] = useState("a41f");
  const [short, setShort] = useState<string[]>([]);
  const [cmp, setCmp] = useState(false);
  const cur = CANDS.find((c) => c.id === sel) ?? CANDS[0];
  const other = cur.id === CANDS[0].id ? CANDS[1] : CANDS[0];
  const shown = cmp ? [cur, other] : [cur];
  const isShort = (id: string) => short.includes(id);
  return (
    <div className={on ? "hx-hs hx-es hx-rv on" : "hx-hs hx-es hx-rv"} ref={ref}>
      <div className="hx-win hx-ri" style={delay(0)}>
        <Header left="Candidates / Backend Engineer" right={<span className="hx-samp"><i />Shortlist {short.length}</span>} />
        <div className="hx-inbox">
          <div className="hx-side">
            <p className="hx-pl"><span>Role</span><em>Open</em></p>
            <b>Backend Engineer</b>
            <div className="hx-chips"><SkillTag>3 years</SkillTag><SkillTag>Node.js</SkillTag><SkillTag>PostgreSQL</SkillTag></div>
            <p className="hx-pl hx-pl-gap"><span>Matched</span><em className="hx-num">6</em></p>
          </div>
          <ul className="hx-rk hx-rk-lg hx-rk-in" style={{ height: ROW * CANDS.length }}>
            {CANDS.map((c, i) => (
              <li key={c.id} className={c.id === sel ? "hx-sel" : undefined} style={{ transform: `translateY(${i * ROW}px)` }}>
                <button type="button" onClick={() => setSel(c.id)} aria-pressed={c.id === sel}>
                  <span className="hx-n">{i + 1}</span>
                  <span className="hx-who-row"><Avatar id={c.id} /><AnonName id={c.id} /></span>
                  <em>{isShort(c.id) ? "Shortlisted" : c.role}</em>
                  <ScoreChip score={c.s} />
                </button>
              </li>
            ))}
          </ul>
          <section className="hx-evd" aria-label="Answer evidence">
            <p className="hx-pl"><span>Their answer</span><em>Question 3 of 6</em></p>
            <p className="hx-evq">Tell me about a time you made something faster.</p>
            <div className="hx-cmp" data-two={cmp}>
              {shown.map((c) => (
                <blockquote key={c.id} className="hx-swap">
                  <span className="hx-evh"><span className="hx-who-row"><Avatar id={c.id} /><b>#{c.id}</b></span><ScoreChip score={c.s} /></span>
                  <p>{c.a}</p>
                  <ul className="hx-evt">{c.t.map(([t, good]) => <li key={t} className={good ? "good" : "gap"}>{t}</li>)}</ul>
                </blockquote>
              ))}
            </div>
            <div className="hx-fl-row">
              <button type="button" className="hx-fakebtn" aria-pressed={isShort(cur.id)} onClick={() => setShort((a) => (a.includes(cur.id) ? a.filter((x) => x !== cur.id) : [...a, cur.id]))}>{isShort(cur.id) ? "Shortlisted" : "Shortlist"}</button>
              <button type="button" className="hx-fakebtn alt" aria-pressed={cmp} onClick={() => setCmp((v) => !v)}>{cmp ? "Back to one" : `Compare with #${other.id}`}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
