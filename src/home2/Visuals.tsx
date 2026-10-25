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

export function HeroSurface() {
  const [fixed, setFixed] = useState(false);
  const [contact, setContact] = useState(false);
  const { ref, on } = useReveal<HTMLDivElement>();
  const score = useTween(fixed ? 86 : 72);
  const people = [
    { id: "a41f", s: fixed ? 86 : 72, note: fixed ? "Names the metric and the result" : "Names the metric, no result" },
    { id: "c92d", s: 78, note: "Strong trade-offs, thin Result" },
    { id: "e07b", s: 64, note: "Solid basics, light on ownership" },
    { id: "f19a", s: 59, note: "Clear answers, limited depth" },
  ];
  const rank = [...people].sort((a, b) => b.s - a.s).map((p) => p.id);
  const star: [string, boolean][] = [["S", true], ["T", true], ["A", true], ["R", fixed]];
  return (
    <div className={on ? "hx-hs hx-rv on" : "hx-hs hx-rv"} ref={ref}>
      <div className="hx-win hx-ri" style={delay(0)}>
        <Header left="HireStepX / Mock interview / Backend Engineer" right={<span className="hx-samp"><i />Interactive sample</span>} />
        <div className="hx-split">
          <section className="hx-pane" aria-label="Candidate view">
            <p className="hx-pl"><span>Candidate view</span><em>Q3 of 6 · 0:42</em></p>
            <ol className="hx-prog" aria-label="Question 3 of 6">{[0, 1, 2, 3, 4, 5].map((i) => <li key={i} className={i < 2 ? "done" : i === 2 ? "now" : undefined} />)}</ol>
            <p className="hx-pq">Tell me about a time you made something faster.</p>
            <p className="hx-tx">
              <span className="hx-ts">0:31</span>
              {fixed ? <>{ANSWER} <ins key="f">{FIX}</ins></> : <>We timed checkout on the UPI path <mark>before and after</mark>, and watched it for two sale weekends. <span className="hx-miss">Result missing</span></>}
            </p>
            <ul className="hx-sr" aria-label="STAR coverage">
              {star.map(([l, ok]) => <li key={l} className={ok ? "ok" : "miss"}><b>{l}</b>{ok ? "Covered" : "Missing"}</li>)}
            </ul>
            <button type="button" className="hx-fix" aria-pressed={fixed} onClick={() => setFixed((v) => !v)}>
              {fixed && <Check />}{fixed ? "Undo the fix" : "Add the missing Result"}
            </button>
          </section>
          <section className="hx-pane hx-pane-r" aria-label="Employer view">
            <p className="hx-pl"><span>Employer view</span><em>Ranked on answers</em></p>
            <ul className="hx-rk" style={{ height: ROW * people.length }} aria-live="polite">
              {people.map((p) => (
                <li key={p.id} className={p.id === "a41f" ? (fixed ? "hx-me hx-hit" : "hx-me") : undefined} style={{ transform: `translateY(${rank.indexOf(p.id) * ROW}px)` }}>
                  <span className="hx-n">{rank.indexOf(p.id) + 1}</span>
                  <span className="hx-who-row"><Avatar id={p.id} />{p.id === "a41f" && contact ? <b className="hx-real">Priya S.</b> : <AnonName id={p.id} />}</span>
                  <em>{p.note}</em>
                  {p.id === "a41f" ? <span className="hx-chipw"><ScoreChip score={score} /></span> : <ScoreChip score={p.s} />}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <div className="hx-float hx-fl-a hx-ri" style={delay(3)} aria-hidden="true">
        <span>Answer score</span>
        <b className="hx-num">{score}</b>
        <i><u style={{ width: `${score}%` }} /></i>
      </div>
      <div className="hx-float hx-fl-b hx-ri" style={delay(4)}>
        <span className="hx-who-row">
          <Avatar id="a41f" />
        </span>
        <span className="hx-num">Rank {rank.indexOf("a41f") + 1} of 4</span>
        <button type="button" className="hx-fakebtn" aria-pressed={contact} onClick={() => setContact((v) => !v)}>{contact ? "Contact shared" : "Unlock to contact"}</button>
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
      </div>
    );
  }
  return (
    <div className="hx-sd">
      <div className="hx-uk">
        <span className="hx-who-row"><Avatar id="a41f" /><span className="hx-who"><b>Priya S.</b><span className="hx-num">Backend Engineer</span></span></span>
        <button type="button" className="hx-fakebtn" aria-pressed={revealed} onClick={() => setRevealed((v) => !v)}>{revealed ? "Sent" : "Say hello"}</button>
      </div>
      {revealed && <p key="r" className="hx-reply hx-swap">Priya: Happy to talk this week.</p>}
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
            <button type="button" className="hx-fix hx-fix-q" aria-pressed={fix} onClick={() => setFix((v) => !v)}>{fix ? "Show my answer" : "See a stronger answer"}</button>
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
