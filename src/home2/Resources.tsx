"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./scenes.css";
import "./resources.css";
import { Scene } from "./ResourceScenes";
import { Arrow, Close, Shell } from "./Pages";
import Skel from "./Skel";
import { delay, usePresence, useSlider, useTween } from "./motion";
import { ITEMS, type Item } from "./resourcesData";

type Kind = Item["k"];
type ReadTime = "any" | "short" | "long";
type Sort = "relevant" | "short" | "az";

export type ResourcesInitial = {
  sortOpen?: boolean;
  q?: string;
  kinds?: Kind[];
  companies?: string[];
  roles?: string[];
  focuses?: string[];
  sheet?: boolean;
  search?: boolean;
};

export const KIND_LABEL: Record<Kind, string> = { guide: "Guide", question: "Question set", salary: "Salary", company: "Company", city: "City", topic: "Topic" };
const KIND_PLURAL: Record<Kind, string> = { guide: "Guides", question: "Questions", salary: "Salaries", company: "Companies", city: "Cities", topic: "Topics" };
const KIND_ORDER: Kind[] = ["guide", "question", "salary", "company", "city", "topic"];

const ROLE_LABEL: Record<string, string> = {
  swe: "Software engineering", pm: "Product management", data: "Data", ml: "Machine learning", campus: "Campus",
  behavioral: "Behavioural", consultant: "Consulting", quant: "Quant", design: "Design", finance: "Finance",
  em: "Engineering management", sales: "Sales", marketing: "Marketing", legal: "Legal", healthcare: "Healthcare", ops: "Operations", hr: "HR", "bfsi-sales": "Banking sales", "civil-services": "Civil services", defence: "Defence", "psu-engineer": "PSU engineering", scientist: "Scientist", writer: "Writing", "ds-research": "Research", "designer-senior": "Senior design", salary: "Salary",
};
const FOCUS_LABEL: Record<string, string> = {
  panel: "Panel", leadership: "Leadership", management: "Management", general: "General", "salary-negotiation": "Salary negotiation",
  technical: "Technical", "system-design": "System design", behavioral: "Behavioural", "case-study": "Case study",
  "campus-placement": "Campus placement", hr: "HR round", "government-psu": "Government and PSU",
};


const TOPICS: [string, string, string][] = [
  ["AI mock interview", "How an AI round works and what it scores.", "/ai-mock-interview"],
  ["Interview anxiety", "Steady your nerves before a real round.", "/interview-anxiety"],
  ["English interview practice", "Speak clearly and with confidence.", "/english-interview-practice"],
  ["Telephonic interviews", "Questions and etiquette for phone rounds.", "/telephonic-interview-questions"],
  ["Walk-in interviews", "What to carry, say and expect on the day.", "/walk-in-interview-preparation"],
  ["One-way video interviews", "Record answers that read well on camera.", "/one-way-video-interview-practice"],
  ["BPO interviews", "Common questions and voice round tips.", "/bpo-interview-questions"],
  ["Bank PO interviews", "Banking, current affairs and HR questions.", "/bank-po-interview-questions"],
  ["MBA personal interviews", "Prepare for the PI after your written test.", "/mba-personal-interview-preparation"],
  ["For students", "Campus placement prep from first year.", "/candidates"],
];

const NOT_CO = new Set(["Career Advice", "Role Guides", "Company Guides", "Fresher Guides"]);
const withTopics = (items: Item[]): Item[] => [...items, ...TOPICS.map(([t, d, h]): Item => ({ k: "topic", t, d, h }))];

const INTENTS: { label: string; hint: string; ic: string; kinds?: Kind[]; focuses?: string[]; roles?: string[]; q?: string }[] = [
  { label: "Prepare for a company", hint: "Company guides and question sets", ic: "M3 14V3h7v11M10 7h3v7M5.5 5.5h2M5.5 8h2M5.5 10.5h2", kinds: ["company", "guide"] },
  { label: "Practise a round", hint: "Behavioural and technical questions", ic: "M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z", kinds: ["question"], focuses: ["behavioral", "technical"] },
  { label: "Check what I should be paid", hint: "Salary pages by role", ic: "M4 4h8M4 7h8M6 4c3 0 4 1.5 4 3s-1.5 3-4.5 3L10 13", kinds: ["salary"] },
  { label: "I am a fresher", hint: "Campus and entry-level prep", ic: "M1.5 6 8 3l6.5 3L8 9zM4 7.5v3c1 1.2 2.5 1.7 4 1.7s3-.5 4-1.7v-3", q: "fresher" },
  { label: "Get ready for product roles", hint: "PM case studies and questions", ic: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", roles: ["pm"], kinds: ["question"] },
];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function meta(i: Item): string {
  if (i.k === "question") return [ROLE_LABEL[i.role ?? ""] ?? i.role, FOCUS_LABEL[i.focus ?? ""] ?? i.focus].filter(Boolean).join(" · ");
  if (i.k === "topic" || i.k === "city") return i.d ?? "";
  return [i.co, i.tag, i.rt ? `${i.rt} min read` : ""].filter(Boolean).join(" · ");
}

export function Vis({ i }: { i: Item }) {
  const scene = Scene({ i });
  if (scene) return scene;
  if (i.k === "guide") {
    return (
      <span className="lb-vis v-guide" aria-hidden="true">
        <span className="lb-doc"><i className="h" /><i style={{ width: "92%" }} /><i style={{ width: "78%" }} /><i className="blk" /><i style={{ width: "84%" }} /><i style={{ width: "56%" }} /></span>
        {i.rt ? <span className="lb-vtag">{i.rt} min read</span> : null}
      </span>
    );
  }
  if (i.k === "question") {
    return (
      <span className="lb-vis v-question" aria-hidden="true">
        <span className="lb-q"><i style={{ width: "88%" }} /><i style={{ width: "58%" }} /></span>
        <span className="lb-stars">{["S", "T", "A", "R"].map((l, n) => <b key={l} style={delay(n)}>{l}</b>)}</span>
        <span className="lb-vtag">{FOCUS_LABEL[i.focus ?? ""] ?? "Practice"}</span>
      </span>
    );
  }
  if (i.k === "salary") {
    return (
      <span className="lb-vis v-salary" aria-hidden="true">
        <span className="lb-bars">{[34, 48, 62, 84, 58, 40].map((h, n) => <i key={n} style={{ height: `${h}%`, ...delay(n) }} />)}</span>
        <span className="lb-range"><i /><u /></span>
        <span className="lb-vtag">Pay range</span>
      </span>
    );
  }
  if (i.k === "company") {
    return (
      <span className="lb-vis v-company" aria-hidden="true">
        <span className="lb-ini">{(i.co ?? i.t).charAt(0)}</span>
        <span className="lb-steps">{[0, 1, 2, 3].map((n) => <i key={n} style={delay(n)} />)}</span>
        <span className="lb-vtag">Interview rounds</span>
      </span>
    );
  }
  if (i.k === "city") {
    return (
      <span className="lb-vis v-city" aria-hidden="true">
        <span className="lb-pin"><i /></span>
        <span className="lb-skyline">{[38, 62, 48, 86, 56, 72, 44].map((h, n) => <i key={n} style={{ height: `${h}%`, ...delay(n) }} />)}</span>
        <span className="lb-vtag">City prep</span>
      </span>
    );
  }
  return (
    <span className="lb-vis v-topic" aria-hidden="true">
      <span className="lb-eq">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <i key={n} style={{ ...delay(n), ["--h" as string]: `${[30, 55, 80, 45, 95, 60, 85, 40, 70, 50, 28][n]}%` }} />)}</span>
      <span className="lb-vtag">Prep topic</span>
    </span>
  );
}

const SORTS: { v: Sort; l: string; d: string }[] = [
  { v: "relevant", l: "Most relevant", d: "A mix of every type" },
  { v: "short", l: "Shortest read", d: "Quick wins first" },
  { v: "az", l: "A to Z", d: "Alphabetical by title" },
];

function Menu({ label, value, options, onChange, defaultOpen = false }: { label: string; value: Sort; options: { v: Sort; l: string; d: string }[]; onChange: (v: Sort) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const pres = usePresence(open, 140);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const cur = options.find((o) => o.v === value) ?? options[0];
  return (
    <div className="lb-dd" ref={ref}>
      <button type="button" className={`lb-ddbtn${open ? " on" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{label}</span><b>{cur.l}</b>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {pres.mounted && (
        <ul className="lb-ddmenu" data-state={pres.closing ? "closing" : undefined} role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.v} role="option" aria-selected={o.v === value}>
              <button type="button" className={o.v === value ? "on" : undefined} onClick={() => { onChange(o.v); setOpen(false); }}>
                <span><b>{o.l}</b><small>{o.d}</small></span>
                {o.v === value && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const HERO_COPY: Record<string, { h: [string, string, string]; p: string }> = {
  guide: { h: ["Interview prep guides, ", "written to be used", "."], p: "Long-form guides on answering, structuring and rehearsing. Read one, then practise it out loud." },
  question: { h: ["Real interview questions, ", "company by company", "."], p: "What top Indian employers actually ask, why they ask it, and how to answer without rambling." },
  salary: { h: ["What roles actually pay ", "in India", "."], p: "Salary ranges by company and level, so you can negotiate with numbers instead of guesses." },
  company: { h: ["How each company ", "runs its interviews", "."], p: "The rounds, the focus areas and the prep that matters for each company." },
  city: { h: ["Hiring markets, ", "city by city", "."], p: "Where the jobs are, what employers in each city look for, and how to prepare." },
  topic: { h: ["Prep by topic, ", "from freshers to career switchers", "."], p: "Pick the situation you are in and start from the guides written for it." },
};

export function ResourcesPage({ initial = {}, items }: { initial?: ResourcesInitial; items?: Item[] }) {
  const ALL = useMemo(() => withTopics(items ?? ITEMS), [items]);
  const roundCounts = useMemo(() => {
    const n = new Map<string, number>();
    ALL.forEach((i) => i.k === "question" && i.focus && i.focus in FOCUS_LABEL && n.set(i.focus, (n.get(i.focus) ?? 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [ALL]);
  const [q, setQ] = useState(initial.q ?? "");
  const [kinds, setKinds] = useState<Kind[]>(initial.kinds ?? []);
  const [companies, setCompanies] = useState<string[]>(initial.companies ?? []);
  const [roles, setRoles] = useState<string[]>(initial.roles ?? []);
  const [focuses, setFocuses] = useState<string[]>(initial.focuses ?? []);
  const [readTime, setReadTime] = useState<ReadTime>("any");
  const [sort, setSort] = useState<Sort>("relevant");
  const [more, setMore] = useState(!!initial.sheet || !!initial.companies?.length);
  const [searchOpen, setSearchOpen] = useState(!!initial.search);
  const panelP = usePresence(more, 180);
  const palP = usePresence(searchOpen && !q.trim(), 140);
  const tabsRef = useSlider<HTMLDivElement>(kinds.join());
  useEffect(() => {
    const row = tabsRef.current;
    const on = row?.querySelector<HTMLElement>(".lb-tab.on");
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollTo({ left: on.offsetLeft - 16, behavior: "smooth" });
  }, [kinds, tabsRef]);
  const [shown, setShown] = useState(12);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coQ, setCoQ] = useState("");
  const [coAll, setCoAll] = useState(false);

  const companyCounts = useMemo(() => {
    const n = new Map<string, number>();
    ALL.forEach((i) => i.co && !NOT_CO.has(i.co) && n.set(i.co, (n.get(i.co) ?? 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [ALL]);
  const roleCounts = useMemo(() => {
    const n = new Map<string, number>();
    ALL.forEach((i) => i.role && i.role in ROLE_LABEL && n.set(i.role, (n.get(i.role) ?? 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }, [ALL]);
  const companyShown = useMemo(() => {
    const t = coQ.trim().toLowerCase();
    if (t) return companyCounts.filter(([c]) => c.toLowerCase().includes(t));
    if (coAll) return companyCounts;
    const top = companyCounts.slice(0, 14);
    return [...top, ...companyCounts.filter(([c]) => companies.includes(c) && !top.some(([x]) => x === c))];
  }, [companyCounts, coQ, coAll, companies]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = ALL.filter((i) => {
      if (term && !`${i.t} ${i.co ?? ""} ${i.tag ?? ""} ${i.d ?? ""} ${i.role ?? ""}`.toLowerCase().includes(term)) return false;
      if (kinds.length && !kinds.includes(i.k)) return false;
      if (companies.length && !(i.co && companies.includes(i.co))) return false;
      if (roles.length && !(i.role && roles.includes(i.role))) return false;
      if (focuses.length && !(i.focus && focuses.includes(i.focus))) return false;
      if (readTime !== "any" && i.rt) {
        if (readTime === "short" && i.rt > 8) return false;
        if (readTime === "long" && i.rt < 9) return false;
      }
      return true;
    });
    if (sort === "relevant" && !term && kinds.length !== 1) {
      const by = KIND_ORDER.map((k) => r.filter((i) => i.k === k));
      const mixed: Item[] = [];
      for (let n = 0; mixed.length < r.length; n++) by.forEach((g) => g[n] && mixed.push(g[n]));
      r = mixed;
    }
    if (sort === "short") r = [...r].sort((a, b) => (a.rt ?? 99) - (b.rt ?? 99));
    if (sort === "az") r = [...r].sort((a, b) => a.t.localeCompare(b.t));
    return r;
  }, [q, kinds, companies, roles, focuses, readTime, sort]);

  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [] as Item[];
    return ALL.filter((i) => `${i.t} ${i.co ?? ""}`.toLowerCase().includes(term)).slice(0, 6);
  }, [q]);

  const count = useTween(results.length, 450);

  const pills: { label: string; clear: () => void }[] = [
    ...kinds.map((k) => ({ label: KIND_PLURAL[k], clear: () => setKinds((p) => p.filter((x) => x !== k)) })),
    ...companies.map((c) => ({ label: c, clear: () => setCompanies((p) => p.filter((x) => x !== c)) })),
    ...roles.map((r) => ({ label: ROLE_LABEL[r] ?? r, clear: () => setRoles((p) => p.filter((x) => x !== r)) })),
    ...focuses.map((f) => ({ label: FOCUS_LABEL[f] ?? f, clear: () => setFocuses((p) => p.filter((x) => x !== f)) })),
    ...(readTime !== "any" ? [{ label: readTime === "short" ? "Under 9 min" : "9 min or more", clear: () => setReadTime("any") }] : []),
  ];
  const activeCount = pills.length;

  function reset() {
    setQ(""); setKinds([]); setCompanies([]); setRoles([]); setFocuses([]); setReadTime("any"); setSort("relevant");
  }

  function applyIntent(n: (typeof INTENTS)[number]) {
    reset();
    if (n.kinds) setKinds(n.kinds);
    if (n.focuses) setFocuses(n.focuses);
    if (n.roles) setRoles(n.roles);
    if (n.q) setQ(n.q);
    setSearchOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Shell active="resources">

      <section className="hx-hero lb-hero">
        <div className="hx-wrap">
          {(() => {
            const hc = initial.kinds?.length === 1 ? HERO_COPY[initial.kinds[0]] : undefined;
            return hc ? (
              <>
                <h1 className="hx-h1">{hc.h[0]}<b>{hc.h[1]}</b>{hc.h[2]}</h1>
                <p className="hx-lede">{hc.p}</p>
              </>
            ) : (
              <>
                <h1 className="hx-h1">Everything you need <b>before the interview</b>.</h1>
                <p className="hx-lede">Guides, question sets, salary pages and company pages in one library. Search it, or narrow it down until you find exactly what you need.</p>
              </>
            );
          })()}

          <div className="lb-main">
            <Skel className="hx-stage lb-stage">
            <div className="lb-top">
              <div
                className="lb-searchwrap"
                role="presentation"
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); inputRef.current?.blur(); } }}
              >
                <form className="lb-search" role="search" onSubmit={(e) => { e.preventDefault(); setSearchOpen(false); }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m12.5 12.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  <input
                    ref={inputRef} type="search" value={q} aria-label="Search the library" placeholder="Search resources"
                    onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    onClick={() => setSearchOpen(true)}
                  />
                  <kbd className="lb-kbd" aria-hidden="true">/</kbd>
                </form>
                {palP.mounted && (
                  <div className="lb-drop lb-pal" role="presentation" data-state={palP.closing ? "closing" : undefined} onMouseDown={(e) => e.preventDefault()}>
                    <p className="lb-ph">I want to</p>
                    <ul className="lb-intents">
                      {INTENTS.map((n) => (
                        <li key={n.label}>
                          <button type="button" className="lb-intent" onClick={() => applyIntent(n)}>
                            <span className="lb-ic"><svg viewBox="0 0 16 16" aria-hidden="true"><path d={n.ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                            <span className="lb-it"><b>{n.label}</b><small>{n.hint}</small></span>
                            <Arrow />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="lb-pcols">
                      <div>
                        <p className="lb-ph">Browse by type</p>
                        <div className="lb-chips">
                          {KIND_ORDER.map((k) => <button key={k} type="button" className="lb-fc" onClick={() => { reset(); setKinds([k]); setSearchOpen(false); }}>{KIND_PLURAL[k]}<small>{ALL.filter((i) => i.k === k).length}</small></button>)}
                        </div>
                      </div>
                      <div>
                        <p className="lb-ph">Popular companies</p>
                        <div className="lb-chips">
                          {companyCounts.slice(0, 6).map(([c, n]) => <button key={c} type="button" className="lb-fc" onClick={() => { reset(); setCompanies([c]); setSearchOpen(false); }}>{c}<small>{n}</small></button>)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {searchOpen && q.trim() && (
                  <ul className="lb-drop" role="listbox" aria-label="Suggestions" onMouseDown={(e) => e.preventDefault()}>
                    {suggestions.map((s) => (
                      <li key={s.h} role="option" aria-selected="false">
                        <a data-no-underline href={s.h}><span className={`lb-chip k-${s.k}`}>{KIND_LABEL[s.k]}</span><b>{s.t}</b><Arrow /></a>
                      </li>
                    ))}
                    <li className="lb-all">
                      <button type="button" onClick={() => setSearchOpen(false)}>{results.length > 0 ? `Show all ${results.length} ${results.length === 1 ? "result" : "results"} for \u201c${q.trim()}\u201d` : `Nothing matches \u201c${q.trim()}\u201d`}</button>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div ref={tabsRef} className="lb-tabs" role="tablist" aria-label="Type">
              <button type="button" role="tab" aria-selected={kinds.length === 0} className={`lb-tab${kinds.length === 0 ? " on" : ""}`} onClick={() => setKinds([])}>All<small>{ALL.length}</small></button>
              {KIND_ORDER.map((k) => (
                <button key={k} type="button" role="tab" aria-selected={kinds.length === 1 && kinds[0] === k} className={`lb-tab${kinds.length === 1 && kinds[0] === k ? " on" : ""}`} onClick={() => setKinds([k])}>{KIND_PLURAL[k]}<small>{ALL.filter((i) => i.k === k).length}</small></button>
              ))}
            </div>
            </Skel>

            <div className="lb-bar">
              <button type="button" className={`lb-morebtn${more ? " on" : ""}`} aria-expanded={more} onClick={() => setMore((v) => !v)}>
                <span className="lb-swap" data-on={more ? "" : undefined} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </span>
                Filters{activeCount ? <b>{activeCount}</b> : null}
              </button>
              <p className="lb-count" aria-live="polite"><b key={results.length} className="lb-num">{count}</b> {results.length === 1 ? "result" : "results"}</p>
              {(pills.length > 0 || q) && (
                <div className="lb-pills">
                  {q && <button type="button" className="lb-pill" onClick={() => setQ("")}>&ldquo;{q}&rdquo;<i aria-hidden="true">×</i></button>}
                  {pills.map((p) => <button key={p.label} type="button" className="lb-pill" onClick={p.clear}>{p.label}<i aria-hidden="true">×</i></button>)}
                  <button type="button" className="lb-clear" onClick={reset}>Clear all</button>
                </div>
              )}
              <Menu label="Sort" value={sort} options={SORTS} onChange={setSort} defaultOpen={!!initial.sortOpen} />
              {panelP.mounted && (
                <div className="lb-panel" data-state={panelP.closing ? "closing" : undefined}>
                  <div className="lb-cols">
                    <div className="lb-grp">
                      <h4>Company{companies.length > 0 && <em>{companies.length} selected</em>}</h4>
                      <label className="lb-fs">
                        <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m12.5 12.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                        <input type="text" value={coQ} onChange={(e) => setCoQ(e.target.value)} placeholder="Find a company" aria-label="Find a company" />
                      </label>
                      <div className="lb-chips">
                        {companyShown.map(([c, n]) => <button key={c} type="button" aria-pressed={companies.includes(c)} className={`lb-fc${companies.includes(c) ? " on" : ""}`} onClick={() => setCompanies((p) => toggle(p, c))}>{c}<small>{n}</small></button>)}
                        {companyShown.length === 0 && <span className="lb-none">No company matches &ldquo;{coQ}&rdquo;</span>}
                      </div>
                      {!coQ && companyCounts.length > 14 && <button type="button" className="lb-more" onClick={() => setCoAll((v) => !v)}>{coAll ? "Show fewer" : `Show all ${companyCounts.length} companies`}</button>}
                    </div>
                    <div className="lb-side">
                      <div className="lb-grp">
                        <h4>Role{roles.length > 0 && <em>{roles.length} selected</em>}</h4>
                        <div className="lb-chips">{roleCounts.map(([r, n]) => <button key={r} type="button" aria-pressed={roles.includes(r)} className={`lb-fc${roles.includes(r) ? " on" : ""}`} onClick={() => setRoles((p) => toggle(p, r))}>{ROLE_LABEL[r]}<small>{n}</small></button>)}</div>
                      </div>
                      <div className="lb-grp">
                        <h4>Round{focuses.length > 0 && <em>{focuses.length} selected</em>}</h4>
                        <div className="lb-chips">{roundCounts.map(([f, n]) => <button key={f} type="button" aria-pressed={focuses.includes(f)} className={`lb-fc${focuses.includes(f) ? " on" : ""}`} onClick={() => setFocuses((p) => toggle(p, f))}>{FOCUS_LABEL[f]}<small>{n}</small></button>)}</div>
                      </div>
                      <div className="lb-grp">
                        <h4>Read time</h4>
                        <div className="lb-seg" role="radiogroup" aria-label="Read time">
                          {([["any", "Any"], ["short", "Under 9 min"], ["long", "9 min +"]] as [ReadTime, string][]).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={readTime === v} className={readTime === v ? "on" : undefined} onClick={() => setReadTime(v)}>{l}</button>)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="lb-pfoot">
                    <button type="button" className="lb-clear" onClick={reset} disabled={activeCount === 0 && !q}>Clear all</button>
                    <button type="button" className="hx-btn sm" onClick={() => setMore(false)}>Show {results.length} {results.length === 1 ? "result" : "results"}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="lb-results">
              {results.length === 0 ? (
                <div className="lb-empty">
                  <h3>Nothing matches those filters.</h3>
                  <p>Remove a filter, or practise the question out loud instead.</p>
                  <button type="button" className="hx-btn sm alt" onClick={reset}>Clear all filters</button>
                </div>
              ) : (
                <ul className="lb-grid" key={`${q}|${kinds}|${companies}|${roles}|${focuses}|${readTime}|${sort}`}>
                      {results.slice(0, shown).map((i, n) => {
                        return (
                          <li key={i.h} style={{ animationDelay: `${(n % 12) * 28}ms` }}>
                            <article className={`lb-card k-${i.k}`}>
                              <Vis i={i} />
                              <div className="lb-body">
                                <span className={`lb-chip k-${i.k}`}>{KIND_LABEL[i.k]}</span>
                                <b><a data-no-underline className="lb-link" href={i.h}>{i.t}</a></b>
                                <div className="lb-foot"><small>{meta(i)}</small><span className="lb-go" aria-hidden="true"><Arrow /></span></div>
                              </div>
                            </article>
                          </li>
                        );
                      })}
                    </ul>
              )}
              {results.length > shown && (
                <button type="button" className="hx-btn sm alt lb-more" onClick={() => setShown((v) => v + 12)}>Show 12 more ({results.length - shown} left)</button>
              )}
            </div>
            {initial.kinds?.length === 1 && (
              <details className="lb-index">
                <summary>Browse all {ALL.filter((i) => i.k === initial.kinds![0]).length} {KIND_PLURAL[initial.kinds[0]].toLowerCase()} as a plain list</summary>
                <ul>
                  {ALL.filter((i) => i.k === initial.kinds![0]).map((i) => <li key={i.h}><a href={i.h}>{i.t}</a></li>)}
                </ul>
              </details>
            )}
          </div>

        </div>
      </section>

      <Close kicker="Read, then rehearse" title={<>Reading helps. Saying it <b>out loud</b> helps more.</>} body="Take what you learned into a spoken session and see exactly what to fix. Your first 2 sessions are free." primary={["Start practising", "/signup"]} secondary={["See pricing", "/pricing"]} notes={["2 free sessions", "No card needed", "No subscription"]} />
    </Shell>
  );
}
