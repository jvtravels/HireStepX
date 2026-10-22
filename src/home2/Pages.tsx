"use client";
import { useEffect, useRef, useState } from "react";
import { ScoreChip } from "../employer/_atoms";
import { homeCss } from "./homeCss";
import { pagesCss } from "./pagesCss";
import { Footer, Nav } from "./Homepage";
import { EmpFaq } from "./Extra";
import { delay, reduced, useReveal, useScrollStage } from "./motion";

export function Arrow() {
  return (
    <svg className="hx-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="hx-arr-c"><path className="hx-arr-a hx-arr-t" d="M6 4L10 8" /><path className="hx-arr-a hx-arr-b" d="M10 8L6 12" /></g>
    </svg>
  );
}

const PHOTOS = new Set(["a41f", "c92d", "e07b", "f19a"]);

export function Av({ id, size }: { id: string; size?: number }) {
  const px = size ?? 24;
  if (PHOTOS.has(id)) {
    return <img className="hx-av" src={`/people/${id}.jpg`} alt="" width={px} height={px} style={{ width: px, height: px }} />;
  }
  return <span className="hx-av hx-id" aria-hidden="true" style={size ? { ["--s" as string]: `${size}px` } : undefined}>{id.slice(0, 2)}</span>;
}

export const Lock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" /></svg>
);

export function Shell({ active, children }: { active: "talent" | "companies"; children: React.ReactNode }) {
  return (
    <div className="hx">
      <style>{homeCss}</style>
      <style>{pagesCss}</style>
      <Nav active={active} talentHref="/candidates" />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export function Win({ left, right, alt, children }: { left: string; right?: React.ReactNode; alt?: string; children: React.ReactNode }) {
  return (
    <div className="pg-win" role={alt ? "img" : undefined} aria-label={alt}>
      <header className="hx-ah">
        <span className="hx-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>{left}</span>
        {right && <em>{right}</em>}
      </header>
      {children}
    </div>
  );
}

export function Close({ kicker, title, body, primary, secondary, notes }: {
  kicker?: string; title: React.ReactNode; body: string; primary: [string, string]; secondary?: [string, string]; notes?: string[];
}) {
  return (
    <section className="hx-sec hx-closing">
      <div className="hx-wrap">
        <div className="hx-end">
          {kicker && <span className="hx-kicker">{kicker}</span>}
          <h2 className="hx-h2">{title}</h2>
          <p>{body}</p>
          <div className="hx-cta">
            <a data-no-underline className="hx-btn lg" href={primary[1]}>{primary[0]} <Arrow /></a>
            {secondary && <a data-no-underline className="hx-btn lg alt" href={secondary[1]}>{secondary[0]}</a>}
          </div>
          {notes && <ul className="hx-endnote">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      </div>
    </section>
  );
}

const WAVE = [10, 22, 14, 30, 18, 36, 24, 12, 28, 16, 32, 20, 10, 26, 14, 22, 30, 18, 12, 24];

export function Mic() {
  return (
    <div className="pg-live">
      <span className="pg-dot" />
      <span className="hx-num">Listening</span>
      <div className="hx-wv" aria-hidden="true">{WAVE.map((h, i) => <b key={i} style={{ height: h, ["--d" as string]: `${i * 55}ms` }} />)}</div>
      <span className="hx-num">0:42</span>
    </div>
  );
}

export function Dim({ items }: { items: [string, number][] }) {
  return (
    <ul className="pg-mini">
      {items.map(([n, v]) => (
        <li key={n}><span>{n}</span><div className="hx-bar"><i style={{ width: `${v}%` }} /></div><b>{v}</b></li>
      ))}
    </ul>
  );
}

/* ── Employers ── */

const HERO_SKILLS = ["Node.js", "PostgreSQL", "System design"];
const POOL = [18, 12, 8, 5];
const HERO_C = [
  { id: "a41f", city: "Bengaluru", sessions: 12, avg: 84, skills: ["Node.js", "PostgreSQL", "System design"] },
  { id: "c92d", city: "Bengaluru", sessions: 5, avg: 76, skills: ["Node.js", "Redis"] },
  { id: "e07b", city: "Hyderabad", sessions: 8, avg: 70, skills: ["PostgreSQL", "System design"] },
  { id: "f19a", city: "Pune", sessions: 3, avg: 64, skills: ["Node.js"] },
];

/* Mirrors scoreCandidateMatch: fit is worth up to 70 (role 0.58, skills 0.34, location 0.08), practice adds up to 30 (0.2 x average score + 1 per session, capped at 10). Role is assumed to fit fully; a different city scores 0.35 on location, as in production. */
const fitPoints = (skillShare: number, locationFit: number) => (0.58 + 0.34 * skillShare + 0.08 * locationFit) * 70;
const practicePoints = (c: { sessions: number; avg: number }) => c.avg * 0.2 + Math.min(c.sessions, 10);
const skillShare = (c: { skills: string[] }, picked: string[]) => picked.filter((x) => c.skills.includes(x)).length / picked.length;

function rankFor(picked: string[]) {
  return HERO_C.map((c) => ({ c, m: Math.round(fitPoints(skillShare(c, picked), c.city === "Bengaluru" ? 1 : 0.35) + practicePoints(c)) })).sort((x, y) => y.m - x.m);
}

function RankList({ picked }: { picked: string[] }) {
  const ranked = rankFor(picked);
  return (
    <ul className="hv-list" style={{ height: HERO_C.length * 60 - 8 }}>
      {HERO_C.map((c, k) => {
        const i = ranked.findIndex((r) => r.c.id === c.id);
        return (
          <li key={c.id} className={i === 0 ? "first" : undefined} style={{ transform: `translateY(${i * 60}px)`, ["--k" as string]: k }}>
            <span>{i + 1}</span>
            <Av id={c.id} size={28} />
            <div><b>Candidate #{c.id}</b><em>{c.sessions} sessions · {c.city}</em></div>
            <ScoreChip score={ranked[i].m} />
          </li>
        );
      })}
    </ul>
  );
}

type Msg = { id: number; from: "you" | "us"; text: string; list?: string[] };
type Reply = { text: string; list?: string[] };

const ASK = "I need a backend engineer in Bengaluru who knows Node.js, PostgreSQL and system design.";
const FIRST: Reply = { text: `Got it. ${POOL[3]} people have practised for this role and match. Here are the top ${HERO_C.length}, best fit first.`, list: HERO_SKILLS };
const FOLLOW: { q: string; a: Reply }[] = [
  { q: "Why is #a41f first?", a: { text: "They have all three skills and 12 practice sessions, with an 84 average. You can read every score for free." } },
  { q: "System design is not a must.", a: { text: `Fair enough. Re-ranked on Node.js and PostgreSQL. ${POOL[2]} people match now.`, list: ["Node.js", "PostgreSQL"] } },
  { q: "What does it cost to reach them?", a: { text: "Reading is free. Reaching one person costs ₹59, and you only pay for the people you pick." } },
];

function ChatList({ picked }: { picked: string[] }) {
  const ranked = rankFor(picked);
  return (
    <ul className="hc-list">
      {ranked.map(({ c, m }, i) => (
        <li key={c.id} style={delay(i)} className={i === 0 ? "top" : undefined}>
          <span>{i === 0 ? "Best fit" : i + 1}</span>
          <Av id={c.id} size={i === 0 ? 48 : 32} />
          <div><b>Candidate #{c.id}</b><em>{picked.filter((x) => c.skills.includes(x)).length} of {picked.length} skills · {c.sessions} sessions</em></div>
          <ScoreChip score={m} />
        </li>
      ))}
    </ul>
  );
}

function HeroChat() {
  const [run, setRun] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<"you" | "us" | null>(null);
  const [typed, setTyped] = useState("");
  const [asked, setAsked] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nid = useRef(0);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  const push = (m: Omit<Msg, "id">) => setMsgs((p) => [...p, { ...m, id: nid.current++ }]);
  const reply = (r: Reply, wait: number) => {
    setTyping("us");
    later(() => { setTyping(null); push({ from: "us", ...r }); setReady(true); }, wait);
  };

  useEffect(() => {
    nid.current = 0;
    setMsgs([]); setAsked([]); setReady(false); setTyped(""); setTyping(null);
    if (reduced()) {
      setMsgs([{ id: 0, from: "you", text: ASK }, { id: 1, from: "us", ...FIRST }]);
      nid.current = 2;
      setReady(true);
      return;
    }
    let tick: ReturnType<typeof setInterval> | undefined;
    later(() => {
      setTyping("you");
      let i = 0;
      tick = setInterval(() => {
        i += 1;
        setTyped(ASK.slice(0, i));
        if (i < ASK.length) return;
        clearInterval(tick);
        later(() => { setTyping(null); setTyped(""); push({ from: "you", text: ASK }); later(() => reply(FIRST, 1100), 350); }, 400);
      }, 30);
    }, 700);
    return () => { clearInterval(tick); timers.current.forEach(clearTimeout); timers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
  }, [msgs, typing, typed]);

  const ask = (k: number) => {
    if (!ready) return;
    setReady(false);
    setAsked((p) => [...p, k]);
    push({ from: "you", text: FOLLOW[k].q });
    later(() => reply(FOLLOW[k].a, 900), 350);
  };
  const left = FOLLOW.map((f, k) => ({ f, k })).filter(({ k }) => !asked.includes(k));

  const picked = [...msgs].reverse().find((m) => m.list)?.list;

  return (
    <div className="hc">
      <div className="hc-body">
        <div className="hc-log" ref={log} role="log" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={`hc-m ${m.from}`}>
              {m.from === "us" && <span className="hc-x" aria-hidden="true">X</span>}
              <div className="hc-b">{m.text}</div>
            </div>
          ))}
          {typing === "you" && typed && <div className="hc-m you"><div className="hc-b hc-caret">{typed}</div></div>}
          {typing === "us" && <div className="hc-m us" aria-hidden="true"><span className="hc-x">X</span><div className="hc-b hc-dots"><span /><span /><span /></div></div>}
        </div>
        <div className="hc-res">
          {picked ? (
            <div key={picked.join()}>
              <div className="hc-top"><div className="hc-skills">{picked.map((k) => <span key={k} className="pg-tag on">{k}</span>)}</div><span>Match score out of 100</span></div>
              <ChatList picked={picked} />
            </div>
          ) : (
            <p className="hc-wait">Your best fits show up here.</p>
          )}
        </div>
      </div>
      <div className="hc-foot">
        {ready && left.length > 0 && <><span className="hc-hint">Ask a follow-up</span>{left.map(({ f, k }) => <button key={k} type="button" className="hc-chip" onClick={() => ask(k)}>{f.q}</button>)}</>}
        {ready && left.length === 0 && <button type="button" className="hc-chip" onClick={() => setRun((r) => r + 1)}>Play it again</button>}
      </div>
    </div>
  );
}

const ROLE_SKILLS = ["Node.js", "PostgreSQL", "System design"];

type CmpCol = { id: string; city: string; exp: string; match: number; fit: [number, number, number]; score: number; sessions: number; active: string; status: string | null; skills: string[] };

const CMP: CmpCol[] = [
  { id: "a41f", city: "Bengaluru", exp: "3 years", match: 97, fit: [100, 100, 100], score: 84, sessions: 12, active: "today", status: "Shortlisted", skills: ["Node.js", "PostgreSQL", "System design"] },
  { id: "c92d", city: "Bengaluru", exp: "4 years", match: 74, fit: [100, 33, 100], score: 76, sessions: 5, active: "3d ago", status: null, skills: ["Node.js", "Redis"] },
];

function Bar({ v, lead, label }: { v: number; lead: boolean; label: string }) {
  return (
    <span className="pg-bar" role="img" aria-label={`${label} ${v}%`}>
      <i className={lead ? "lead" : undefined} style={{ width: `${v}%` }} />
    </span>
  );
}

function CompareView() {
  const best = (f: (c: CmpCol) => number) => Math.max(...CMP.map(f));
  const FIT = ["Role", "Skill", "Location"];
  return (
    <table className="pg-tbl" aria-label="Comparison of candidate a41f and candidate c92d for a Backend Engineer role">
      <thead>
        <tr>
          <td><span className="pg-tl">Backend Engineer</span></td>
          {CMP.map((c) => (
            <th key={c.id} scope="col">
              <span className="pg-ch">
                <Av id={c.id} size={44} />
                <span><b>Candidate #{c.id}</b><small>{c.city} · {c.exp}</small></span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Match score</th>
          {CMP.map((c) => (
            <td key={c.id}>
              <span className="pg-mt"><ScoreChip score={c.match} />{c.match === best((x) => x.match) && <em className="pg-lead">Higher</em>}</span>
              <span className="pg-fit">
                {FIT.map((n, k) => (
                  <span key={n}><small>{n}</small><Bar v={c.fit[k]} lead={c.fit[k] === Math.max(...CMP.map((x) => x.fit[k]))} label={n} /><b>{c.fit[k]}%</b></span>
                ))}
              </span>
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Practice score</th>
          {CMP.map((c) => (
            <td key={c.id}>
              <span className="pg-nm"><b>{c.score}</b><small>Across all sessions</small></span>
              <Bar v={c.score} lead={c.score === best((x) => x.score)} label="Practice score" />
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Sessions</th>
          {CMP.map((c) => <td key={c.id}><span className="pg-nm"><b>{c.sessions}</b><small>Last active {c.active}</small></span></td>)}
        </tr>
        <tr>
          <th scope="row">Skills</th>
          {CMP.map((c) => (
            <td key={c.id}>
              <span className="pg-tags">{c.skills.map((k) => <span key={k} className={ROLE_SKILLS.includes(k) ? "pg-tag on" : "pg-tag"}>{k}</span>)}</span>
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Status</th>
          {CMP.map((c) => <td key={c.id}>{c.status ? <span className="pg-chip">{c.status}</span> : <span className="pg-none">Not set</span>}</td>)}
        </tr>
      </tbody>
    </table>
  );
}


function EmpHero() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="hx-hero">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <h1 className="hx-h1">Tell us who you need. We will show you who can <b>already do it</b>.</h1>
        <p className="hx-lede">Describe the role in plain words. We line up the people who have practised for it, with the answers behind every score. Reading is free. You pay only to reach someone.</p>
        <div className="hx-cta">
          <a data-no-underline className="hx-btn lg" href="/signup">Start hiring <Arrow /></a>
        </div>
        <div className="hx-stage pg-hero-stage hx-ri" style={delay(2)}><HeroChat /></div>
      </div>
    </section>
  );
}

/* ── How it works ── */

const STEP_MS = 7000;
const HOW: [string, string][] = [
  ["Post a job", "Describe the role, the skills and the location. It takes a minute and costs nothing."],
  ["We match", "Scored practice answers are matched to what your role asks for."],
  ["We rank", "Best fit first, using fit to your role and how much they have practised."],
  ["You review", "Skill scores, readiness and practice history are open. Put any two side by side."],
  ["Unlock", "Pay to see the name and contact details, then invite them to interview."],
];

export const d = (s: number): React.CSSProperties => ({ ["--d" as string]: `${s}s` });

const HS_SKILLS: [string, number][] = [["Node.js", 88], ["PostgreSQL", 84], ["System design", 80]];
const HS_RANK = [["a41f", 97, 2], ["e07b", 80, 0], ["c92d", 74, 3], ["f19a", 66, 1]] as const;

export function SkillBars({ rows, start }: { rows: [string, number | null][]; start: number }) {
  return (
    <ul className="hs-bars">
      {rows.map(([s, v], i) => (
        <li key={s} className={v === null ? "none" : undefined}><span>{s}</span><i style={{ ...d(start + i * 0.45), ["--w" as string]: `${v ?? 0}%` }} /><b className="hs-in" style={d(start + 0.5 + i * 0.45)}>{v ?? "–"}</b></li>
      ))}
    </ul>
  );
}

export function Cursor({ press }: { press: number }) {
  return (
    <span className="hs-cur" style={d(press - 1.1)} aria-hidden="true">
      <svg viewBox="0 0 20 22" width="20" height="22"><path d="M2 2l15 7.5-6.3 1.8L8.6 18z" fill="currentColor" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      <em>You</em>
    </span>
  );
}

export function Summary({ children, at }: { children: React.ReactNode; at: number }) {
  return (
    <p className="hs-sum hs-in" style={d(at)}>
      <b><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>HireStepX summary</b>
      {children}
    </p>
  );
}

function HowScene({ n }: { n: number }) {
  if (n === 0) return (
    <Win left="New job" right="Sample" alt="A job being posted: Backend Engineer with three skills in Bengaluru">
      <div className="pg-body">
        <div className="pg-field"><span>Role</span><div className="pg-input"><span className="hs-type" style={d(0.3)}>Backend Engineer</span></div></div>
        <div className="pg-field"><span>Skills</span><div className="hv-chips">{HERO_SKILLS.map((s, i) => <span key={s} className="pg-tag on hs-pop" style={d(1.6 + i * 0.25)}>{s}</span>)}</div></div>
        <div className="pg-two hs-in" style={d(2.5)}><div className="pg-input">Bengaluru or remote</div><div className="pg-input">3+ years</div></div>
        <div className="hs-swap hs-act">
          <span className="hx-fakebtn hs-press hs-gone" style={d(3.2)}>Post job</span>
          <Cursor press={3.2} />
          <span className="hs-ok hs-in" style={d(3.9)}>Posted. Matching has started.</span>
        </div>
      </div>
    </Win>
  );
  if (n === 1) return (
    <Win left="Backend Engineer" right="Sample" alt="Skill scores found in candidates' practice answers, and four people who match">
      <div className="pg-body">
        <div className="hs-h"><b>Best score per skill</b><span className="hs-count hs-pop" style={d(2.9)}>4 people match</span></div>
        <SkillBars rows={HS_SKILLS} start={0.4} />
        <div className="hs-people">
          {HS_RANK.map(([id], i) => <span key={id} className="hs-pop" style={d(2 + i * 0.3)}><Av id={id} size={28} />#{id}</span>)}
          <p className="hs-note hs-in" style={d(3.4)}>Found in their practice answers, not their resume.</p>
        </div>
      </div>
    </Win>
  );
  if (n === 2) return (
    <Win left="Backend Engineer" right="Ranked on 3 skills" alt="Four candidates reordered with the best fit first">
      <div className="pg-body">
        <ul className="hs-rank">
          {HS_RANK.map(([id, score, from], i) => (
            <li key={id} className={i === 0 ? "hs-sel" : undefined} style={{ ...d(0.9), ["--from" as string]: `${(from - i) * 64}px` }}>
              <span>{i + 1}</span>
              <Av id={id} size={32} />
              <b>Candidate #{id}</b>
              {i === 0 ? <em className="hs-in" style={d(2.1)}>Best fit</em> : <em />}
              <ScoreChip score={score} />
              {i === 0 && <Cursor press={3.4} />}
            </li>
          ))}
        </ul>
      </div>
    </Win>
  );
  if (n === 3) return (
    <Win left="Backend Engineer" right="Compare" alt="Two candidates opened side by side with their skill scores">
      <div className="pg-body hs-two">
        <div className="hs-col">
          <div className="pg-who"><Av id="a41f" size={40} /><div><b>Candidate #a41f</b><span>12 sessions · Hire</span></div><span className="sc"><ScoreChip score={97} /></span></div>
          <SkillBars rows={HS_SKILLS} start={0.3} />
          <Summary at={1.6}>Clear, structured answers. Strong on Node.js and database design, with a calm, specific style under follow-ups.</Summary>
        </div>
        <div className="hs-col">
          <div className="pg-who"><Av id="c92d" size={40} /><div><b>Candidate #c92d</b><span>5 sessions</span></div><span className="sc"><ScoreChip score={74} /></span></div>
          <SkillBars rows={[["Node.js", 79], ["PostgreSQL", null], ["System design", null]]} start={0.3} />
          <Summary at={2}>Solid on Node.js. Fewer sessions, and no database or design answers yet to judge.</Summary>
        </div>
      </div>
    </Win>
  );
  return (
    <Win left="Candidate #a41f" right="Sample" alt="A locked name and contact details being unlocked">
      <div className="pg-body">
        <div className="pg-who"><Av id="a41f" size={40} /><div><b>Backend Engineer</b><span>Bengaluru · 12 sessions</span></div><span className="sc"><ScoreChip score={97} /></span></div>
        <Summary at={0.5}>Clear, structured answers. Strong on Node.js and databases.</Summary>
        <div className="hs-swap">
          <div className="pg-lockrow hs-gone" style={d(2.4)}><span><Lock />Name</span><span><Lock />Phone</span><span><Lock />Email</span></div>
          <div className="pg-lockrow open hs-in" style={d(2.4)}><span>Name<em>Asha Menon</em></span><span>Phone<em>+91 98765 43210</em></span><span>Email<em>asha@example.com</em></span></div>
        </div>
        <div className="hs-swap hs-act">
          <span className="hx-fakebtn hs-press hs-gone" style={d(1.6)}>Unlock for ₹59</span>
          <Cursor press={1.6} />
          <span className="hs-ok hs-in" style={d(2.7)}>Unlocked. Invite them to interview.</span>
        </div>
      </div>
    </Win>
  );
}

const HOW_ICONS: React.ReactNode[] = [
  <path key="1" d="M12 5v14M5 12h14" />,
  <g key="2"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></g>,
  <path key="3" d="M4 7h10M4 12h14M4 17h7" />,
  <g key="4"><rect x="3" y="5" width="7" height="14" rx="2" /><rect x="14" y="5" width="7" height="14" rx="2" /></g>,
  <g key="5"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8.5 11V8a3.5 3.5 0 017 0" /></g>,
];

export function HowItWorks({ steps, icons, scene, wideAt, title }: { steps: [string, string][]; icons: React.ReactNode[]; scene: (n: number) => React.ReactNode; wideAt?: number; title: string }) {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [step, setStep] = useState(0);
  const [armed, setArmed] = useState(false);
  const [seen, setSeen] = useState(false);
  const [held, setHeld] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined" || reduced()) return;
    setArmed(true);
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const box = tabs.current;
    const tab = box?.children[step] as HTMLElement | undefined;
    if (box && tab && box.scrollWidth > box.clientWidth) box.scrollTo({ left: tab.offsetLeft - 16, behavior: reduced() ? "auto" : "smooth" });
  }, [step]);

  const paused = armed && (!seen || held);
  return (
    <section className="pg-sec" id="how">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head ctr hx-ri" style={delay(0)}>
          <span className="hx-kicker">How it works</span>
          <h2 className="hx-h2">{title}</h2>
        </div>
        <div className={`hs${paused ? " paused" : ""}`} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
          <div className="hs-tabs hx-ri" style={delay(1)} role="tablist" aria-label="How it works" ref={tabs}>
            {steps.map(([t], i) => (
              <button key={t} type="button" role="tab" id={`hs-t${i}`} aria-selected={i === step} aria-controls="hs-panel" className={`hs-tab${i === step ? " on" : i < step ? " done" : ""}`} onClick={() => setStep(i)}>
                <span className="hs-bar"><i style={{ animationDuration: `${STEP_MS}ms` }} onAnimationEnd={() => setStep((s) => (s + 1) % steps.length)} /></span>
                <span className="hs-t"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[i]}</svg>{t}</span>
              </button>
            ))}
          </div>
          <div ref={stage} id="hs-panel" role="tabpanel" aria-labelledby={`hs-t${step}`} className="hs-stage hx-ri" style={delay(2)}>
            <div key={step} className={`hs-scene${step === wideAt ? " wide" : ""}`}>{scene(step)}</div>
          </div>
          <p key={step} className="hs-cap" aria-live="polite">{steps[step][1]}</p>
        </div>
      </div>
    </section>
  );
}

/* ── Why HireStepX ── */

const CLAIMS = ["Strong communicator", "Led a team of 5", "Expert in Node.js and PostgreSQL"];

const DIFFS = ["Read answers, not resumes", "Free until you contact", "Rank and reject yourself"];

const DIFF_ICONS: React.ReactNode[] = [
  <path key="a" d="M4 5h16v11H9l-5 4z" />,
  <g key="b"><circle cx="12" cy="12" r="8" /><path d="M9 12.5l2.2 2.2L15.5 10" /></g>,
  <path key="c" d="M5 7h14M8 12h8M11 17h2" />,
];

function WhyUs() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <section className="pg-sec pg-band">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head ctr hx-ri" style={delay(0)}>
          <span className="hx-kicker">Why HireStepX</span>
          <h2 className="hx-h2">Most hiring starts with a resume. Ours starts with how they answer.</h2>
        </div>
        <div className="wy hx-ri" style={delay(1)}>
          <div className="wy-claim">
            <span className="wy-tag">On the resume</span>
            <ul>{CLAIMS.map((c) => <li key={c}>{c}</li>)}</ul>
            <p>Claims. Nothing here to check.</p>
          </div>
          <div className="wy-proof">
            <div className="wy-top">
              <span className="wy-tag on">In their answer</span>
              <span className="wy-sample">Sample</span>
            </div>
            <div className="wy-who">
              <span className="wy-id" aria-hidden="true">a4</span>
              <div><b>Candidate #a41f</b><span>Backend Engineer, Bengaluru</span></div>
            </div>
            <p className="wy-q">&ldquo;The feed query filtered on user and sorted by date, so I added <mark>one index on both columns</mark>. It went from 1.8 seconds to 90 milliseconds.&rdquo;</p>
            <div className="wy-skill"><span>PostgreSQL score</span><ScoreChip score={84} /></div>
          </div>
        </div>
        <div className="wy-diff hx-ri" style={delay(2)}>
          {DIFFS.map((d, i) => <h3 key={d}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{DIFF_ICONS[i]}</svg>{d}</h3>)}
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */

const OPEN_SKILLS: [string, number][] = [["Node.js", 88], ["PostgreSQL", 84], ["System design", 80]];

function EvidenceView() {
  return (
    <Win left="Candidate #a41f" right="Backend Engineer, Bengaluru" alt="A candidate's skill scores, readiness and practice sessions">
      <div className="pg-body">
        <ul className="fl-open">
          {OPEN_SKILLS.map(([s, v]) => (
            <li key={s}><span>{s}</span><i style={{ ["--w" as string]: `${v}%` }} /><ScoreChip score={v} /></li>
          ))}
          <li className="fl-plain"><span>Readiness</span><b>Hire</b></li>
          <li className="fl-plain"><span>Practice sessions</span><b>12</b></li>
        </ul>
      </div>
    </Win>
  );
}

const PIPE: [string, string, string][] = [
  ["a41f", "Candidate #a41f", "Interviewing"],
  ["c92d", "Candidate #c92d", "Interview invited"],
  ["e07b", "Candidate #e07b", "Shortlisted"],
  ["f19a", "Candidate #f19a", "Rejected"],
];

function DecideView() {
  return (
    <Win left="Backend Engineer" right="3 in your pipeline" alt="Candidates with a hiring status each, and a conversation with one of them">
      <ul className="pl">
        {PIPE.slice(0, 3).map(([id, name, st]) => (
          <li key={id}>
            <Av id={id} size={36} />
            <b>{name}</b>
            <span className="pg-chip">{st}</span>
          </li>
        ))}
      </ul>
      <div className="pg-body ft-chat">
        <div className="pg-msg">
          <p className="me">Your checkout answer stood out. Can we talk Friday?</p>
          <p className="them">Yes, Friday works. I am interested.</p>
        </div>
      </div>
    </Win>
  );
}

const TAB_ICONS: React.ReactNode[] = [
  <path key="r" d="M4 6h16M4 12h11M4 18h6" />,
  <g key="e"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></g>,
  <g key="c"><rect x="3" y="5" width="7" height="14" rx="2" /><rect x="14" y="5" width="7" height="14" rx="2" /></g>,
  <path key="d" d="M4 5h16v11H9l-5 4z" />,
];

export type FeatureTab = { name: string; title: string; body: string; points?: string[]; view: (alt: boolean) => React.ReactNode };

const TABS: FeatureTab[] = [
  {
    name: "Ranking",
    title: "Best fit first, every time.",
    body: "Each candidate is scored against the role, skills and location you posted, plus how much they have practised.",
    points: ["Matching reruns when you edit the role", "And when a candidate updates their resume", "And every night, so new people appear"],
    view: (alt) => { const picked = alt ? ["Node.js", "PostgreSQL"] : HERO_SKILLS; return <Win left="Backend Engineer" right={`Ranked on ${picked.length} skills`} alt="Candidates ranked for a Backend Engineer role"><div className="pg-body"><RankList picked={picked} /></div></Win>; },
  },
  {
    name: "Evidence",
    title: "Read what they proved, not what they claim.",
    body: "Every match opens to skill scores, readiness and practice history. Read their answers in their own words. Only the name and contact details wait for an unlock.",
    view: () => <EvidenceView />,
  },
  {
    name: "Compare",
    title: "Two finalists. One clear call.",
    body: "Put two candidates next to each other: match score, practice score, sessions, skills and where each stands.",
    view: () => <CompareView />,
  },
  {
    name: "Decide and talk",
    title: "Track every candidate to a decision.",
    body: "Invite someone with a note and a date. Mark each person shortlisted, interviewing, hired or rejected, and talk to them without leaving HireStepX. Attach a file up to 8 MB.",
    view: () => <DecideView />,
  },
];

export function Features({ tabs, icons, kicker, title }: { tabs: FeatureTab[]; icons: React.ReactNode[]; kicker: string; title: string }) {
  const { ref: headRef, on } = useReveal<HTMLDivElement>();
  const { ref, stage, i, go } = useScrollStage<HTMLDivElement, HTMLDivElement>(tabs.length);
  const [live, setLive] = useState(true);
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const fit = () => {
      const el = stage.current?.querySelector<HTMLElement>(".ft-in");
      if (!el) return;
      el.style.setProperty("--fit", "1");
      if (getComputedStyle(el).display !== "flex") return;
      const room = window.innerHeight - 48 - 80;
      let k = Math.min(1, room / el.offsetHeight);
      for (let n = 0; n < 4 && k < 1; n++) {
        el.style.setProperty("--fit", String(k));
        k = Math.min(1, k * (room / el.getBoundingClientRect().height));
      }
      el.style.setProperty("--fit", String(k));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [stage]);
  useEffect(() => {
    setLive(true);
    setAlt(false);
    if (reduced()) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      ids.push(setTimeout(() => setAlt(true), 3400));
      ids.push(setTimeout(() => { setLive(false); setAlt(false); }, 6600));
      ids.push(setTimeout(() => { setLive(true); run(); }, 7200));
    };
    run();
    return () => ids.forEach(clearTimeout);
  }, [i]);
  return (
    <>
      <section className="pg-sec ft-head" id="features">
        <div ref={headRef} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
          <div className="em-head ctr hx-ri" style={delay(0)}>
            <span className="hx-kicker">{kicker}</span>
            <h2 className="hx-h2">{title}</h2>
          </div>
        </div>
      </section>
      <div ref={ref} className="ft">
        <div className="ft-stick">
          <div ref={stage} className="ft-stage">
            <div className="ft-bg" aria-hidden="true">{tabs.map((t, k) => <i key={t.name} style={{ opacity: `var(--b${k}, ${k === 0 ? 1 : 0})` }} />)}</div>
            <div className="ft-in">
            <div className="ft-tabs" role="group" aria-label={kicker}>
              <span className="ft-notch" style={{ ["--k" as string]: i }} aria-hidden="true" />
              {tabs.map((t, k) => (
                <button key={t.name} type="button" className={k === i ? "on" : undefined} aria-label={t.name} aria-current={k === i} onClick={() => go(k)}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[k]}</svg>
                </button>
              ))}
            </div>
            <div className="ft-card">
              {tabs.map((t, k) => (
                <div key={t.name} className={`ft-p hx-rv${k === i ? " act" : ""}${k === i && live ? " on" : ""}`} aria-hidden={k !== i} style={{ opacity: `var(--o${k}, ${k === 0 ? 1 : 0})`, transform: `translateY(var(--y${k}, 0px))` }}>
                  <div className="pg-copy">
                    <span className="ft-name"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[k]}</svg>{t.name}</span>
                    <h3 className="hx-h2">{t.title}</h3>
                    <p>{t.body}</p>
                    {t.points && <ul className="pg-list">{t.points.map((x) => <li key={x}>{x}</li>)}</ul>}
                  </div>
                  <div className="ft-vis">{t.view(k === i && alt)}</div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Pricing ── */

const FREE = ["Post roles and get ranked matches for each", "Skill scores, practice history and their answers", "Compare and reject anyone"];

function EmpPricing() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  return (
    <section className="pg-sec pg-band" id="pricing">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="em-head hx-ri" style={delay(0)}>
          <span className="hx-kicker">Pricing</span>
          <h2 className="hx-h2">Free until you want to talk to someone.</h2>
        </div>
        <div className="pc">
          <div className="pc-l hx-ri" style={delay(1)}>
            <div className="pl-grp">
              <h3><span>Free</span></h3>
              <ul>{FREE.map((f, i) => <li key={f}><i />{f}</li>)}</ul>
            </div>
            <div className={`pl-grp paid${open ? " open" : ""}`}>
              <h3><span>When you contact</span></h3>
              <div className="pl-price">
                <b>₹59</b>
                <p>per candidate, to unlock their name and contact.<br />Ten at once: ₹299. <a href="/pricing">Full pricing</a></p>
              </div>
            </div>
          </div>
          <div className="pc-r hx-ri" style={delay(2)}>
            <div className="pg-stage pc-stage">
              <Win left="Candidate profile" alt="A candidate profile with scores open and name and contact locked">
                <div className="pf">
                  <div className="pf-head">
                    <Av id="a41f" size={72} />
                    <div className="pf-id">
                      {open ? <b>Priya S.</b> : <span className="pf-lock"><Lock />Name</span>}
                      <span>Backend Engineer, Bengaluru</span>
                    </div>
                    <span className="pf-ready"><small>Readiness</small><b>Hire</b></span>
                  </div>
                  <div className={`pf-contact${open ? " open" : ""}`}>{open ? <>Phone, email</> : <><Lock />Phone and email</>}</div>
                  <h4>Skill scores</h4>
                  <ul className="fl-open">
                    {OPEN_SKILLS.map(([s, v]) => (
                      <li key={s}><span>{s}</span><i style={{ ["--w" as string]: `${v}%` }} /><ScoreChip score={v} /></li>
                    ))}
                  </ul>
                  <dl className="pf-facts">
                    <div><dt>Practice sessions</dt><dd>12</dd></div>
                    <div><dt>Resume and answers</dt><dd>Open</dd></div>
                  </dl>
                </div>
                <div className="pg-ctl pc-ctl"><span>{open ? "Unlocked. You can invite Priya now." : "Read the scores first. Decide after."}</span><button type="button" className="hx-fakebtn pg-press" onClick={() => setOpen(!open)}>{open ? "Lock again" : "Try an unlock"}</button></div>
              </Win>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function EmployersPage() {
  return (
    <Shell active="companies">
      <EmpHero />
      <HowItWorks steps={HOW} icons={HOW_ICONS} scene={(n) => <HowScene n={n} />} wideAt={3} title="From a job post to a conversation in five steps." />
      <WhyUs />
      <Features tabs={TABS} icons={TAB_ICONS} kicker="What you get" title="Everything from first match to final offer." />
      <EmpPricing />
      <EmpFaq />
      <Close
        kicker="Ready when you are"
        title={<>See who fits before you spend a rupee.</>}
        body="Post a role, read the ranking, and pay only for the people you want to meet."
        primary={["Start hiring", "/signup"]}
        secondary={["Talk to us", "/contact"]}
        notes={["Posting is free", "Scores are free to read", "Pay only to contact"]}
      />
    </Shell>
  );
}

