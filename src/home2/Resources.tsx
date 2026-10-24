"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Scene, sceneCss } from "./ResourceScenes";
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
      <style>{resourcesCss}</style>

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
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); inputRef.current?.blur(); } }}
              >
                <form className="lb-search" role="search" onSubmit={(e) => { e.preventDefault(); setSearchOpen(false); }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m12.5 12.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  <input
                    ref={inputRef} type="search" value={q} aria-label="Search the library" aria-expanded={searchOpen} aria-haspopup="listbox" placeholder="Search a company, role or question"
                    onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    onClick={() => setSearchOpen(true)}
                  />
                  <kbd className="lb-kbd" aria-hidden="true">/</kbd>
                </form>
                {palP.mounted && (
                  <div className="lb-drop lb-pal" data-state={palP.closing ? "closing" : undefined} onMouseDown={(e) => e.preventDefault()}>
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
              <p className="lb-note">This preview shows a sample of the library. The live page searches every guide, question set, salary page, salary report, company page and city page.</p>
            </div>
          </div>

        </div>
      </section>

      <Close kicker="Read, then rehearse" title={<>Reading helps. Saying it <b>out loud</b> helps more.</>} body="Take what you learned into a spoken session and see exactly what to fix. Your first 2 sessions are free." primary={["Practise free", "/signup"]} secondary={["See pricing", "/pricing"]} notes={["2 free sessions", "No card needed", "No subscription"]} />
    </Shell>
  );
}

export const resourcesCss = sceneCss + `
.lb-hero { padding-bottom: 72px; }
.lb-hero .hx-wrap { text-align: center; }
.lb-hero .hx-h1 { font-size: 52px; margin: 56px auto 0; max-width: 24ch; }
.lb-hero .hx-h1 { animation: lb-txt .7s cubic-bezier(.22,1,.36,1) both; }
@keyframes lb-txt { from { opacity: 0; transform: translateY(10px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
.lb-hero .hx-lede { margin: 18px auto 0; max-width: 60ch; font-size: 19px; }
.lb-main { max-width: 1120px; margin: 48px auto 0; text-align: left; }
.lb-top { display: grid; gap: 18px; justify-items: center; }
.lb-top .lb-searchwrap { width: 100%; max-width: 680px; }
.lb-searchwrap { position: relative; z-index: 5; }
.lb-search { display: flex; align-items: center; gap: 12px; height: 60px; box-shadow: none; padding: 0 16px; border-radius: 12px; background: var(--white); border: 1px solid var(--line-2); color: var(--ink-3); transition: border-color .15s, box-shadow .15s; }
.lb-search:focus-within { border-color: var(--btn); box-shadow: 0 0 0 3px oklch(0.359 0.135 278.697 / 0.14); }
.lb-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 18px; color: var(--ink); }
.lb-search input::placeholder { color: var(--ink-3); }
.lb-kbd { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-3); border: 1px solid var(--line-2); border-radius: 6px; padding: 2px 8px; }
.lb-drop { text-align: left; position: absolute; top: 68px; left: 0; right: 0; list-style: none; margin: 0; padding: 8px; border-radius: 14px; background: var(--white); border: 1px solid var(--line); box-shadow: 0 24px 48px oklch(0.3 0.1 280 / 0.16); animation: lb-pop .16s cubic-bezier(.22,1,.36,1) both; }
.lb-drop a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; color: var(--ink); }
.lb-drop a:hover { background: var(--wash); }
.lb-drop.lb-pal { padding: 16px; display: grid; gap: 14px; }
.lb-ph { margin: 0 0 6px; padding: 0 4px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
.lb-intents { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.lb-intent { width: 100%; display: flex; align-items: center; gap: 14px; text-align: left; font: inherit; color: var(--ink); background: transparent; border: 0; border-radius: 12px; padding: 10px 12px; cursor: pointer; transition: background .15s; }
.lb-intent:hover, .lb-intent:focus-visible { background: var(--wash); outline: 0; }
.lb-ic { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: oklch(0.359 0.135 278.697 / 0.08); color: var(--btn); transition: background .15s, color .15s; }
.lb-ic svg { width: 18px; height: 18px; }
.lb-intent:hover .lb-ic, .lb-intent:focus-visible .lb-ic { background: var(--btn); color: var(--white); }
.lb-it { flex: 1; min-width: 0; display: grid; gap: 1px; }
.lb-pal .lb-it b { flex: none; font-size: 15px; font-weight: 500; }
.lb-it small { font-size: 13px; color: var(--ink-3); }
.lb-intent > svg { opacity: 0; transform: translateX(-4px); transition: opacity .15s, transform .2s cubic-bezier(.22,1,.36,1); }
.lb-intent:hover > svg, .lb-intent:focus-visible > svg { opacity: 1; transform: none; }
.lb-pcols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding-top: 14px; border-top: 1px solid var(--line); }
.lb-pcols .lb-chips { gap: 6px; }
.lb-pcols .lb-fc { font-size: 13px; padding: 5px 12px; }
.lb-all { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 6px; }
.lb-all button { width: 100%; text-align: left; font: inherit; font-size: 14px; color: var(--btn); background: transparent; border: 0; border-radius: 10px; padding: 10px 12px; cursor: pointer; }
.lb-all button:hover { background: var(--wash); }
.lb-drop svg, .lb-go svg, .lb-pc svg { width: 16px; height: 16px; flex: none; color: var(--btn); }
.lb-drop b { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-bar { position: relative; display: flex; align-items: center; gap: 12px; padding: 18px 24px 14px; }
.lb-count { margin: 0; flex: none; white-space: nowrap; font-size: 15px; color: var(--ink-2); }
.lb-count b { color: var(--ink); font-weight: 600; font-family: 'Geist Mono', ui-monospace, monospace; }
.lb-pills { flex: 1 1 auto; min-width: 0; padding: 0; display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; align-items: center; gap: 8px; }
.lb-pill { flex: none; white-space: nowrap; font: inherit; font-size: 13px; font-weight: 500; color: var(--btn); background: oklch(0.359 0.135 278.697 / 0.08); border: 0; border-radius: 99px; padding: 6px 8px 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; animation: lb-pop .18s cubic-bezier(.22,1,.36,1) both; }
.lb-pill i { font-style: normal; font-size: 16px; line-height: 1; opacity: .7; }
.lb-pill:hover i { opacity: 1; }
.lb-clear { flex: none; white-space: nowrap; font: inherit; font-size: 13px; color: var(--ink-3); background: none; border: 0; cursor: pointer; padding: 6px 8px; text-decoration: underline; text-underline-offset: 3px; }
.lb-results { padding-top: 20px; }
.lb-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.lb-grid li { animation: lb-up .4s cubic-bezier(.22,1,.36,1) both; }
.lb-card { position: relative; height: 100%; display: flex; flex-direction: column; border-radius: 14px; background: var(--white); border: 1px solid var(--line); overflow: hidden; transition: border-color .15s, box-shadow .2s, transform .2s; }
.lb-card:hover, .lb-card:focus-within { border-color: var(--btn); transform: translateY(-2px); }
.lb-body { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px 22px; flex: 1; }
.lb-body b { font-size: 17px; font-weight: 600; line-height: 1.35; letter-spacing: -0.005em; padding-right: 22px; color: var(--ink); }
.lb-link::after { content: ''; position: absolute; inset: 0; z-index: 1; }
.lb-link:focus-visible { outline: none !important; }
.lb-card:focus-within { outline: 2px solid var(--btn); outline-offset: 2px; }
.lb-body small { font-size: 13px; line-height: 1.5; color: var(--ink-3); }
.lb-chip { align-self: flex-start; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; flex: none; }
.lb-chip.k-guide { color: oklch(0.36 0.135 278); background: oklch(0.945 0.03 285); }
.lb-chip.k-question { color: oklch(0.42 0.12 320); background: oklch(0.955 0.03 320); }
.lb-chip.k-salary { color: oklch(0.44 0.1 55); background: oklch(0.955 0.035 55); }
.lb-chip.k-company { color: oklch(0.4 0.08 250); background: oklch(0.95 0.025 250); }
.lb-chip.k-city { color: oklch(0.4 0.09 195); background: oklch(0.95 0.03 195); }
.lb-chip.k-topic { color: var(--ink-2); background: var(--wash); border: 1px solid var(--line); }
.k-guide .lb-vis { background: oklch(0.945 0.035 285); }
.k-question .lb-vis { background: oklch(0.95 0.035 330); }
.k-salary .lb-vis { background: oklch(0.955 0.045 70); }
.k-company .lb-vis { background: oklch(0.945 0.03 240); }
.k-city .lb-vis { background: oklch(0.95 0.032 195); }
.v-city { display: grid; place-items: end center; }
.lb-pin { position: absolute; top: 22px; left: 50%; width: 22px; height: 22px; margin-left: -11px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--btn); transition: transform .3s cubic-bezier(.22,1,.36,1); }
.lb-pin i { position: absolute; inset: 7px; border-radius: 50%; background: var(--white); }
.lb-card:hover .lb-pin, .lb-card:focus-within .lb-pin { transform: rotate(-45deg) translate(3px, -3px); }
.lb-skyline { display: flex; align-items: flex-end; gap: 5px; height: 46%; margin-bottom: 36px; }
.lb-skyline i { display: block; width: 14px; border-radius: 3px 3px 0 0; background: oklch(0.2 0.05 195 / 0.22); transition: background .25s; }
.lb-card:hover .lb-skyline i, .lb-card:focus-within .lb-skyline i { background: var(--btn); opacity: .75; }
.k-topic .lb-vis { background: oklch(0.95 0.03 170); }
.lb-empty { text-align: center; padding: 56px 24px; border-radius: 14px; background: var(--wash); border: 1px solid var(--line); }
.lb-empty h3 { margin: 0; font-size: 20px; font-weight: 600; color: var(--ink); }
.lb-empty p { margin: 8px 0 20px; font-size: 15px; color: var(--ink-2); }
.lb-more { display: flex; margin: 20px auto 0; cursor: pointer; font-family: inherit; }
.lb-note { margin: 18px 0 0; font-size: 13px; color: var(--ink-3); }
.lb-tabs { position: relative; display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 40px; }
.lb-tab { font: inherit; font-size: 15px; font-weight: 500; color: var(--ink-2); background: var(--white); border: 1px solid var(--line-2); border-radius: 99px; padding: 9px 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .15s; }
.lb-tab small { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }
.lb-tab:hover { border-color: var(--btn); color: var(--btn); }
.lb-tab.on { background: var(--btn); border-color: var(--btn); color: var(--white); }
.lb-tab.on small { color: oklch(1 0 0 / 0.7); }
.lb-morebtn { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 14px; font-weight: 500; color: var(--ink); background: var(--white); border: 1px solid var(--line-2); border-radius: 10px; padding: 8px 14px; cursor: pointer; }
.lb-morebtn.on, .lb-morebtn:hover { border-color: var(--btn); color: var(--btn); }
.lb-morebtn b { background: var(--btn); color: var(--white); border-radius: 99px; font-size: 12px; min-width: 20px; height: 20px; display: grid; place-items: center; }
.lb-panel { position: absolute; z-index: 25; top: calc(100% - 6px); left: 0; right: 0;  border-radius: 20px; background: var(--white); border: 1px solid var(--line); box-shadow: 0 28px 60px oklch(0.3 0.1 280 / 0.18); animation: lb-pop .2s cubic-bezier(.22,1,.36,1) both; overflow: hidden; }
.lb-cols { display: grid; grid-template-columns: 1.15fr 1fr; }
.lb-cols > * { padding: 24px 28px; }
.lb-cols > * + * { border-left: 1px solid var(--line); }
.lb-side { display: grid; gap: 22px; align-content: start; }
.lb-grp { display: grid; gap: 12px; align-content: start; }
.lb-grp h4 { margin: 0; display: flex; align-items: baseline; justify-content: space-between; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
.lb-grp h4 em { font-style: normal; font-family: inherit; letter-spacing: 0; text-transform: none; font-size: 12px; color: var(--btn); }
.lb-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.lb-none { font-size: 14px; color: var(--ink-3); padding: 6px 0; }
.lb-fs { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--wash); color: var(--ink-3); transition: border-color .15s, background .15s; }
.lb-fs:focus-within { border-color: var(--btn); background: var(--white); color: var(--btn); }
.lb-fs input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 14px; color: var(--ink); }
.lb-more { justify-self: start; font: inherit; font-size: 13px; font-weight: 500; color: var(--btn); background: none; border: 0; padding: 2px 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.lb-seg { display: grid; grid-template-columns: repeat(3, 1fr); padding: 4px; gap: 4px; border-radius: 12px; background: var(--wash); border: 1px solid var(--line); }
.lb-seg button { font: inherit; font-size: 14px; color: var(--ink-2); background: transparent; border: 0; border-radius: 8px; padding: 8px 6px; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
.lb-seg button:hover { color: var(--btn); }
.lb-seg button.on { background: var(--white); color: var(--btn); font-weight: 500; box-shadow: 0 1px 3px oklch(0.2 0.03 280 / 0.14); }
.lb-pfoot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 28px; border-top: 1px solid var(--line); background: var(--wash); }
.lb-pfoot .lb-clear:disabled { opacity: .4; cursor: default; }
.lb-dd { position: relative; margin-left: auto; flex: none; }
.lb-ddbtn { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 14px; color: var(--ink-3); background: var(--white); border: 1px solid var(--line-2); border-radius: 10px; padding: 8px 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
.lb-ddbtn b { font-weight: 500; color: var(--ink); }
.lb-ddbtn svg { color: var(--ink-3); transition: transform .2s cubic-bezier(.22,1,.36,1); }
.lb-ddbtn:hover, .lb-ddbtn.on { border-color: var(--btn); }
.lb-ddbtn.on svg { transform: rotate(180deg); color: var(--btn); }
.lb-ddmenu { position: absolute; z-index: 30; top: calc(100% + 8px); right: 0; width: 260px; margin: 0; padding: 6px; list-style: none; border-radius: 14px; background: var(--white); border: 1px solid var(--line); box-shadow: 0 24px 48px oklch(0.3 0.1 280 / 0.16); animation: lb-pop .16s cubic-bezier(.22,1,.36,1) both; }
.lb-ddmenu button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; font: inherit; color: var(--ink); background: transparent; border: 0; border-radius: 10px; padding: 10px 12px; cursor: pointer; }
.lb-ddmenu button:hover { background: var(--wash); }
.lb-ddmenu button.on { background: oklch(0.359 0.135 278.697 / 0.08); color: var(--btn); }
.lb-ddmenu button span { display: grid; gap: 2px; }
.lb-ddmenu button b { font-size: 15px; font-weight: 500; }
.lb-ddmenu button small { font-size: 13px; color: var(--ink-3); }
.lb-ddmenu button svg { flex: none; color: var(--btn); }
.lb-fc { font: inherit; font-size: 14px; color: var(--ink-2); background: var(--white); border: 1px solid var(--line-2); border-radius: 99px; padding: 6px 14px; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; transition: all .15s; }
.lb-fc small { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }
.lb-fc:hover { border-color: var(--btn); color: var(--btn); }
.lb-fc.on { background: oklch(0.359 0.135 278.697 / 0.1); border-color: var(--btn); color: var(--btn); font-weight: 500; }
.lb-bar { padding: 28px 0 14px; }
.lb-results { padding-top: 6px; }
.lb-stage { margin-top: 0; padding: 56px 48px 48px; }
.lb-stage .lb-top { gap: 22px; }
.lb-stage .lb-top .lb-searchwrap { max-width: 760px; }
.lb-stage .lb-search { height: 68px; padding: 0 22px; border-radius: 18px; border-color: transparent; box-shadow: none; }
.lb-stage .lb-search:focus-within { border-color: var(--btn); box-shadow: 0 0 0 3px oklch(0.359 0.135 278.697 / 0.14); }
.lb-stage .lb-search input { font-size: 19px; }
.lb-stage .lb-search svg { width: 22px; height: 22px; color: var(--btn); }
.lb-stage .lb-drop { top: 78px; }
.lb-stage .lb-tabs { margin-top: 36px; }
.lb-stage .lb-tab { border-color: oklch(1 0 0 / 0.0); box-shadow: none; }
.lb-stage .lb-tab { font-size: 16px; padding: 10px 18px; }
.lb-stage .lb-tab.on { box-shadow: none; }
.lb-bar { padding-top: 40px; }
.lb-card { border-radius: 20px; }
.lb-body { gap: 12px; padding: 22px 24px 20px; }
.lb-body b { font-size: 19px; line-height: 1.3; letter-spacing: -0.015em; padding-right: 0; }
.lb-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.lb-foot small { font-size: 13px; color: var(--ink-3); }
.lb-go { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--wash); transition: background .2s, transform .2s; }
.lb-go svg { transition: color .2s; }
.lb-card:hover .lb-go, .lb-card:focus-within .lb-go { background: var(--btn); transform: translateX(2px); }
.lb-card:hover .lb-go svg, .lb-card:focus-within .lb-go svg { color: var(--white); }
.lb-vis { position: relative; height: 176px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; overflow: hidden; background-image: radial-gradient(oklch(0.2 0.05 280 / 0.07) 1px, transparent 1px); background-size: 14px 14px; }
.lb-vtag { position: absolute; left: 14px; bottom: 12px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.02em; color: var(--ink-2); background: var(--white); border-radius: 99px; padding: 3px 10px; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.1); }
.lb-doc { width: 148px; padding: 16px 16px 18px; border-radius: 10px; background: var(--white); display: grid; gap: 7px; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.08), 0 14px 28px -10px oklch(0.4 0.12 285 / 0.3); transform: rotate(-2deg); transition: transform .4s cubic-bezier(.22,1,.36,1); }
.lb-doc i { display: block; height: 5px; border-radius: 3px; background: var(--ink); opacity: .14; transform-origin: left; transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .3s; }
.lb-doc i.h { height: 9px; width: 64%; background: var(--btn); opacity: .85; margin-bottom: 4px; }
.lb-doc i.blk { height: 26px; border-radius: 6px; background: var(--btn); opacity: .1; }
.lb-card:hover .lb-doc, .lb-card:focus-within .lb-doc { transform: rotate(0deg) translateY(-4px); }
.lb-card:hover .lb-doc i:not(.h), .lb-card:focus-within .lb-doc i:not(.h) { opacity: .3; }
.lb-q { width: 168px; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: var(--white); display: grid; gap: 6px; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.08), 0 12px 24px -10px oklch(0.4 0.12 320 / 0.3); }
.lb-q i { display: block; height: 5px; border-radius: 3px; background: var(--ink); opacity: .2; }
.lb-stars { display: flex; gap: 8px; }
.lb-stars b { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border-radius: 10px; background: var(--white); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 14px; font-weight: 500; color: var(--ink-3); box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.1); transition: background .25s, color .25s, transform .25s; transition-delay: calc(var(--i, 0) * 70ms); }
.lb-card:hover .lb-stars b, .lb-card:focus-within .lb-stars b { background: var(--btn); color: var(--white); transform: translateY(-3px); }
.lb-bars { display: flex; align-items: flex-end; gap: 7px; height: 64px; }
.lb-bars i { width: 16px; border-radius: 5px 5px 2px 2px; background: var(--white); box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.1); transform-origin: bottom; transition: transform .5s cubic-bezier(.22,1,.36,1), background .3s; transition-delay: calc(var(--i, 0) * 50ms); }
.lb-bars i:nth-child(4) { background: var(--btn); }
.lb-card:hover .lb-bars i, .lb-card:focus-within .lb-bars i { transform: scaleY(1.18); }
.lb-range { position: relative; width: 190px; height: 8px; border-radius: 99px; background: var(--white); }
.lb-range i { position: absolute; top: 0; bottom: 0; left: 28%; width: 34%; border-radius: 99px; background: var(--btn); opacity: .6; transition: left .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1), opacity .3s; }
.lb-range u { position: absolute; top: -5px; left: 45%; width: 18px; height: 18px; border-radius: 50%; background: var(--white); border: 3px solid var(--btn); transition: left .5s cubic-bezier(.22,1,.36,1); }
.lb-card:hover .lb-range i, .lb-card:focus-within .lb-range i { left: 14%; width: 62%; opacity: 1; }
.lb-card:hover .lb-range u, .lb-card:focus-within .lb-range u { left: 70%; }
.lb-ini { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 18px; background: var(--white); font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, sans-serif; font-size: 30px; font-weight: 600; color: var(--btn); box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.08), 0 14px 28px -10px oklch(0.4 0.1 240 / 0.35); transition: transform .3s cubic-bezier(.22,1,.36,1); }
.lb-card:hover .lb-ini, .lb-card:focus-within .lb-ini { transform: translateY(-3px) scale(1.04); }
.lb-steps { display: flex; align-items: center; }
.lb-steps i { width: 14px; height: 14px; border-radius: 50%; background: var(--white); border: 2px solid oklch(0.2 0.05 240 / 0.2); position: relative; margin-right: 28px; transition: border-color .25s, background .25s; transition-delay: calc(var(--i, 0) * 90ms); }
.lb-steps i:last-child { margin-right: 0; }
.lb-steps i:not(:last-child)::after { content: ''; position: absolute; left: 100%; top: 4px; width: 28px; height: 2px; background: oklch(0.2 0.05 240 / 0.2); transition: background .25s; transition-delay: calc(var(--i, 0) * 90ms); }
.lb-card:hover .lb-steps i, .lb-card:focus-within .lb-steps i { border-color: var(--btn); }
.lb-card:hover .lb-steps i:last-child, .lb-card:focus-within .lb-steps i:last-child { background: var(--btn); }
.lb-card:hover .lb-steps i::after, .lb-card:focus-within .lb-steps i::after { background: var(--btn); }
.lb-eq { display: flex; align-items: center; gap: 6px; height: 72px; }
.lb-eq i { display: block; width: 7px; height: var(--h, 50%); border-radius: 4px; background: var(--btn); opacity: .4; transition: opacity .2s; }
.lb-card:hover .lb-eq i, .lb-card:focus-within .lb-eq i { opacity: .9; animation: lb-eq .9s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 80ms); }
.lb-tabs::before { content: ''; position: absolute; left: 0; top: 0; width: var(--sw, 0); height: var(--sh, 0); border-radius: 99px; background: var(--btn); transform: translate(var(--sx, 0), var(--sy, 0)); opacity: 0; pointer-events: none; transition: transform .32s cubic-bezier(.22,1,.36,1), width .32s cubic-bezier(.22,1,.36,1), height .32s cubic-bezier(.22,1,.36,1); }
.lb-tabs[data-ready]::before { opacity: 1; }
.lb-tabs .lb-tab { position: relative; }
.lb-tabs[data-ready] .lb-tab { background: transparent; transition: color .25s, border-color .15s; }
.lb-tabs[data-ready] .lb-tab.on { border-color: transparent; }
.lb-tabs[data-ready] .lb-tab:not(.on):hover { background: var(--wash); }
.lb-dd { transform-origin: top right; }
.lb-ddmenu { transform-origin: top right; }
.lb-ddmenu[data-state="closing"] { animation: lb-out .14s cubic-bezier(.4,0,1,1) both; pointer-events: none; }
.lb-panel { transform-origin: top left; }
.lb-panel[data-state="closing"] { animation: lb-out .18s cubic-bezier(.4,0,1,1) both; pointer-events: none; }
.lb-drop { transform-origin: top center; }
.lb-drop[data-state="closing"] { animation: lb-out .14s cubic-bezier(.4,0,1,1) both; pointer-events: none; }
.lb-ddbtn svg { transition: transform .22s cubic-bezier(.22,1,.36,1); }
.lb-ddbtn.on svg { transform: rotate(180deg); }
.lb-swap { position: relative; width: 16px; height: 16px; display: inline-block; flex: none; }
.lb-swap svg { position: absolute; inset: 0; transition: opacity .2s, transform .25s cubic-bezier(.22,1,.36,1), filter .2s; }
.lb-swap svg:last-child { opacity: 0; transform: rotate(-60deg) scale(.5); filter: blur(2px); }
.lb-swap[data-on] svg:first-child { opacity: 0; transform: rotate(60deg) scale(.5); filter: blur(2px); }
.lb-swap[data-on] svg:last-child { opacity: 1; transform: none; filter: none; }
.lb-num { display: inline-block; animation: lb-numpop .32s cubic-bezier(.22,1,.36,1); }
@keyframes lb-numpop { from { opacity: 0; transform: translateY(6px) scale(.85); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes lb-out { to { opacity: 0; transform: translateY(-4px) scale(.98); } }
@keyframes lb-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes lb-pop { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes lb-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes lb-eq { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(.35); } }
@media (prefers-reduced-motion: reduce) { .lb-hero .hx-h1, .lb-ddmenu, .lb-panel, .lb-num, .lb-grid li, .lb-fill, .lb-pill, .lb-drop, .lb-eq i { animation: none !important; } .lb-tabs::before, .lb-tab, .lb-swap svg, .lb-ddbtn svg, .lb-card, .lb-go, .lb-doc i, .lb-range i, .lb-range u, .lb-path, .lb-steps i, .v-question b { transition: none; } }
@container (max-width: 900px) {
  .lb-hero { padding-bottom: 48px; }
  .lb-hero .hx-h1 { font-size: 34px; margin-top: 20px; }
  .lb-hero .hx-lede { font-size: 18px; }
  
  .lb-search { height: 48px; }
  .lb-kbd { display: none; }
  .lb-pcols { grid-template-columns: 1fr; gap: 14px; }
  .lb-drop.lb-pal { padding: 12px; }
  .lb-bar { padding: 20px 0 12px; flex-wrap: wrap; }
  .lb-count { flex: 1 1 100%; order: 3; font-size: 13px; }
  .lb-pills { flex: 1 1 100%; order: 4; }
  .lb-dd { margin-left: auto; }
  .lb-ddbtn span { display: none; }
  .lb-ddmenu { width: 240px; }
  .lb-tabs { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; margin-right: -16px; padding-bottom: 4px; scrollbar-width: none; }
  .lb-tab { flex: none; }
  .lb-cols { grid-template-columns: 1fr; }
  .lb-cols > * { padding: 18px 16px; }
  .lb-cols > * + * { border-left: 0; border-top: 1px solid var(--line); }
  .lb-pfoot { padding: 12px 16px; }
  .lb-main { margin-top: 28px; }
  .lb-stage { padding: 24px 16px 28px; border-radius: 22px; }
  .lb-stage .lb-search { height: 56px; }
  .lb-stage .lb-tabs { margin-top: 24px; }
  .lb-grid { grid-template-columns: 1fr; }
}
`;
