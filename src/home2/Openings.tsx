"use client";
import { useEffect, useMemo, useState } from "react";
import { captureClientEvent } from "../posthogClient";
import { ArrowLeft, Briefcase, Building2, Check, Clock, Gift, ListChecks, MapPin, Sparkles, Target, UserCheck, Wifi, type LucideIcon } from "lucide-react";
import { Arrow, Shell } from "./Pages";
import {
  DEPARTMENT_LABEL, departmentOf, experienceLabel, matchesOpeningSearch, practiseHref, WORK_MODE_LABEL, type PublicOpening,
} from "../../server-handlers/_public-openings-helpers";

const openingsCss = `
.op-head { padding: 96px 0 40px; text-align: center; }
.op-head .hx-h1 { margin-top: 14px; }
.op-head .hx-lede { max-width: 56ch; }
.op-facts { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 0; }
.op-head .op-facts { justify-content: center; margin-top: 24px; }
.op-facts li { font-size: 13px; font-weight: 500; color: var(--ink-2); padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--white); }
.op-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.op-card { display: flex; flex-direction: column; gap: 10px; height: 100%; padding: 24px; border-radius: 16px; border: 1px solid var(--line); background: var(--white); transition: border-color .15s, background .15s; }
.op-card:hover { border-color: var(--btn); background: var(--wash); }
.op-card h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 22px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 600; }
.op-card .op-facts { margin-top: auto; padding-top: 6px; }
.op-more .hx-arr { width: 14px; height: 14px; flex: none; }
.op-tools { display: grid; gap: 14px; margin-bottom: 24px; }
.op-search { position: relative; max-width: 480px; }
.op-search input { width: 100%; height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--white); font: inherit; font-size: 15px; color: var(--ink); }
.op-search input:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.op-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.op-chip { font: inherit; font-size: 14px; font-weight: 500; color: var(--ink-2); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--white); cursor: pointer; }
.op-chip:hover { border-color: var(--btn); }
.op-chip[aria-pressed="true"] { background: var(--btn); border-color: var(--btn); color: var(--white); }
.op-chip span { opacity: .65; margin-left: 4px; }
.op-clear { font: inherit; font-size: 14px; color: var(--ink-3); background: none; border: 0; padding: 7px 4px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.op-none { text-align: center; padding: 40px 0; color: var(--ink-2); }
.op-card .op-more { margin-top: 6px; }
.op-more { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--btn); }
.op-empty { max-width: 640px; margin: 0 auto; padding: 32px; border-radius: 16px; border: 1px solid var(--line); background: var(--wash); text-align: center; }
.op-empty h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 26px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 600; }
.op-empty p { margin: 8px 0 20px; color: var(--ink-2); }
.op-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
.op-body { padding: 24px 0 40px; display: grid; gap: 40px; max-width: 760px; margin: 0 auto; }
.op-body h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 26px; line-height: 1.1; letter-spacing: -0.02em; font-weight: 600; margin-bottom: 10px; }
.op-body p { color: var(--ink-2); text-wrap: pretty; }
.op-steps { margin: 0; padding: 0; list-style: none; counter-reset: st; color: var(--ink-2); display: grid; gap: 12px; }
.op-steps li { counter-increment: st; display: grid; grid-template-columns: 28px 1fr; gap: 12px; align-items: start; }
.op-steps li::before { content: counter(st); width: 28px; height: 28px; border-radius: 999px; background: var(--wash); border: 1px solid var(--line-2); color: var(--btn); font-size: 13px; font-weight: 600; display: grid; place-items: center; }
.op-note { font-size: 14px; color: var(--ink-3); }
.op-note a { color: var(--ink-3); text-decoration: underline; text-underline-offset: 3px; }
.op-note a:hover { color: var(--btn); }
.op-list { padding-top: 0; }
.op-body .op-lead { margin-bottom: 14px; }
.op-note2 { margin-top: 12px; }
.op-dhead { padding-block: 40px 28px; border-bottom: 1px solid var(--line); text-align: left; }
.op-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--ink-3); }
.op-back:hover { color: var(--btn); }
.op-dtop { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-top: 20px; }
.op-dhead .hx-h1 { margin: 0; max-width: 28ch; text-align: left; font-size: clamp(28px, 3.4vw, 40px); line-height: 1.1; }
.op-dhead .hx-btn { flex: none; }
.op-meta { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.op-meta li { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--white); font-size: 14px; color: var(--ink-2); }
.op-meta li svg { color: var(--ink-3); }
.op-dlayout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 56px; align-items: start; padding: 40px 0 56px; }
.op-aside { position: sticky; top: 88px; display: grid; gap: 16px; padding: 24px; border-radius: 16px; border: 1px solid var(--line); background: var(--white); }
.op-aside h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.op-aside .hx-btn { width: 100%; justify-content: center; }
.op-aside .op-note a { color: var(--ink-3); }
.op-bar { display: none; }
.op-more { border-top: 1px solid var(--line); padding: 32px 0 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.op-more p { margin: 0; color: var(--ink-2); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.op-main { display: grid; gap: 36px; max-width: 720px; }
.op-main h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 20px; line-height: 1.2; letter-spacing: -0.01em; font-weight: 600; margin-bottom: 12px; }
.op-main p { color: var(--ink-2); text-wrap: pretty; }
.op-h { display: flex; align-items: center; gap: 12px; }
.op-ico { flex: none; width: 32px; height: 32px; border-radius: 10px; display: inline-grid; place-items: center; background: var(--wash); border: 1px solid var(--line); color: var(--ink); }
.op-main h2.op-h { margin-bottom: 14px; }
.op-list-b { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; color: var(--ink-2); }
.op-list-b li { display: grid; grid-template-columns: 20px 1fr; gap: 10px; align-items: start; }
.op-list-b li svg { margin-top: 3px; color: var(--ink); }
.op-win { margin: 0; display: grid; gap: 14px; }
.op-win dt { font-size: 14px; font-weight: 600; color: var(--ink); }
.op-win dd { margin: 2px 0 0; color: var(--ink-2); }
@container (max-width: 1000px) {
  .op-dlayout { grid-template-columns: 1fr; gap: 32px; }
  .op-aside { position: static; }
}
@container (max-width: 1000px) and (min-width: 721px) {
  .op-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 720px) {
  .op-head { padding: 56px 0 28px; }
  .op-dtop { flex-direction: column; gap: 16px; }
  .op-dhead .op-dtop .hx-btn { display: none; }
  .op-aside .hx-btn { display: none; }
  .op-bar { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: var(--white); border-top: 1px solid var(--line); }
  .op-bar .hx-btn { width: 100%; justify-content: center; }
  .op-more { padding-bottom: 96px; }
  .op-grid { grid-template-columns: 1fr; }
  .op-body { padding-bottom: 44px; gap: 32px; }
  .op-cta .hx-btn { width: 100%; }
}
`;

function Facts({ o }: { o: PublicOpening }) {
  const exp = experienceLabel(o.experienceMin, o.experienceMax);
  const mode = o.workMode ? WORK_MODE_LABEL[o.workMode] : null;
  const items = [o.location, mode && !o.location.toLowerCase().includes(mode.toLowerCase()) ? mode : null, exp, o.employmentType === "full-time" ? "Full-time" : o.employmentType].filter(Boolean) as string[];
  return <ul className="op-facts">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}

export function OpeningsIndexPage({ openings }: { openings: PublicOpening[] }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  useEffect(() => { captureClientEvent("openings_list_view", { count: openings.length }); }, [openings.length]);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp.get("q") ?? "");
    setDept(sp.get("dept") ?? "");
  }, []);
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (dept) sp.set("dept", dept);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, dept]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of openings) m.set(departmentOf(o), (m.get(departmentOf(o)) ?? 0) + 1);
    return Object.keys(DEPARTMENT_LABEL).filter((k) => m.has(k)).map((k) => [k, m.get(k) ?? 0] as const);
  }, [openings]);
  const shown = useMemo(
    () => openings.filter((o) => (!dept || departmentOf(o) === dept) && matchesOpeningSearch(o, q)),
    [openings, dept, q],
  );
  const filtering = !!dept || !!q.trim();
  const clear = () => { setQ(""); setDept(""); };

  return (
    <Shell active="openings">
      <style>{openingsCss}</style>
      <section className="op-head">
        <div className="hx-wrap">
          <span className="hx-kicker">Open roles</span>
          <h1 className="hx-h1">Roles hiring on <b>HireStepX</b></h1>
          <p className="hx-lede">Browse roles from employers hiring on HireStepX. Practise an interview for the role you want, then choose whether to share your scored report with the employer.</p>
        </div>
      </section>
      <section className="hx-sec op-list" aria-label="Open roles">
        <div className="hx-wrap">
          {openings.length === 0 ? (
            <div className="op-empty">
              <h2>No roles are listed right now</h2>
              <p>New roles appear here as employers list them. Practising now gets your scored answers ready.</p>
              <a data-no-underline className="hx-btn lg" href="/signup?source=openings">Start practising <Arrow /></a>
            </div>
          ) : (
            <>
              <div className="op-tools">
                <form className="op-search" role="search" onSubmit={(e) => e.preventDefault()}>
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search open roles" placeholder="Search roles, skills or location" />
                </form>
                <div className="op-chips" role="group" aria-label="Department">
                  <button type="button" className="op-chip" aria-pressed={!dept} onClick={() => setDept("")}>All<span>{openings.length}</span></button>
                  {counts.map(([k, n]) => (
                    <button key={k} type="button" className="op-chip" aria-pressed={dept === k} onClick={() => setDept(dept === k ? "" : k)}>
                      {DEPARTMENT_LABEL[k]}<span>{n}</span>
                    </button>
                  ))}
                  {filtering && <button type="button" className="op-clear" onClick={clear}>Clear filters</button>}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="op-none" role="status">No roles match. <button type="button" className="op-clear" onClick={clear}>Clear filters</button></p>
              ) : (
                <ul className="op-grid">
                  {shown.map((o) => (
                    <li key={o.slug}>
                      <a data-no-underline className="op-card" href={`/openings/${o.slug}`}
                        onClick={() => captureClientEvent("openings_card_click", { opening: o.slug })}>
                        <h2>{o.title}</h2>
                        <Facts o={o} />
                        <span className="op-more">View role <Arrow /></span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </Shell>
  );
}

function Head({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return <h2 className="op-h"><span className="op-ico" aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>{children}</h2>;
}

function Bullets({ title, icon, items }: { title: string; icon: LucideIcon; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <Head icon={icon}>{title}</Head>
      <ul className="op-list-b">{items.map((t) => <li key={t}><Check size={16} strokeWidth={2.5} aria-hidden="true" /><span>{t}</span></li>)}</ul>
    </section>
  );
}

export function OpeningDetailPage({ opening: o, url }: { opening: PublicOpening; url: string }) {
  useEffect(() => { captureClientEvent("opening_view", { opening: o.slug }); }, [o.slug]);
  const share = `https://wa.me/?text=${encodeURIComponent(`${o.title}, hiring on HireStepX: ${url}`)}`;
  const d = o.details;
  const exp = experienceLabel(o.experienceMin, o.experienceMax);
  const mode = o.workMode ? WORK_MODE_LABEL[o.workMode] : null;
  const ROW_ICON: Record<string, LucideIcon> = { Location: MapPin, "Work mode": Wifi, Experience: Clock, Type: Briefcase, Department: Building2 };
  const rows: [string, string][] = [
    ["Location", o.location],
    ["Work mode", mode && !o.location.toLowerCase().includes(mode.toLowerCase()) ? mode : ""],
    ["Experience", exp ?? ""],
    ["Type", o.employmentType === "full-time" ? "Full-time" : o.employmentType ?? ""],
    ["Department", DEPARTMENT_LABEL[departmentOf(o)]],
  ].filter(([, v]) => v) as [string, string][];
  const signUp = (where: string) => (
    <a data-no-underline className="hx-btn" href={practiseHref(o)}
      onClick={() => captureClientEvent("opening_practise_click", { opening: o.slug, role: o.title, where })}>
      Sign up
    </a>
  );
  return (
    <Shell active="openings">
      <style>{openingsCss}</style>
      <div className="op-dhead">
        <div className="hx-wrap">
          <a className="op-back" href="/openings"><ArrowLeft size={16} aria-hidden="true" />All open roles</a>
          <div className="op-dtop">
            <h1 className="hx-h1">{o.title}</h1>
            {signUp("header")}
          </div>
          <ul className="op-meta">
            {rows.map(([k, v]) => { const I = ROW_ICON[k]; return <li key={k}><I size={16} strokeWidth={1.75} aria-hidden="true" /><span className="sr-only">{k}: </span>{v}</li>; })}
          </ul>
        </div>
      </div>
      <div className="hx-wrap">
        <div className="op-dlayout">
          <div className="op-main">
            <section>
              <Head icon={Building2}>About the role</Head>
              <p>{d?.about ?? o.summary}</p>
            </section>
            <Bullets title="What you will do" icon={ListChecks} items={d?.responsibilities} />
            <Bullets title="What we are looking for" icon={UserCheck} items={d?.requirements} />
            <Bullets title="Good to have" icon={Sparkles} items={d?.goodToHave} />
            {d?.success?.length ? (
              <section>
                <Head icon={Target}>What success looks like</Head>
                <dl className="op-win">
                  {d.success.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.text}</dd></div>)}
                </dl>
              </section>
            ) : null}
            <Bullets title="What you get" icon={Gift} items={d?.offers} />
            {o.skills.length > 0 && (
              <section>
                <Head icon={Briefcase}>Skills for this role</Head>
                <ul className="op-facts">{o.skills.map((s) => <li key={s}>{s}</li>)}</ul>
              </section>
            )}
          </div>
          <aside className="op-aside" aria-label="Apply to practise">
            <h2>Practise for this role</h2>
            {signUp("aside")}
            <p className="op-note">Employers stay private until you have practised and chosen to share your profile.</p>
            <p className="op-note">
              <a href={share} target="_blank" rel="noopener noreferrer"
                onClick={() => captureClientEvent("opening_share_click", { opening: o.slug, channel: "whatsapp" })}>Share on WhatsApp</a>
              {" · "}
              <a href={`/contact?topic=report-listing&opening=${encodeURIComponent(o.slug)}`}>Report this listing</a>
            </p>
          </aside>
        </div>
        <div className="op-more">
          <p>Looking at other options?</p>
          <a className="hx-btn alt" data-no-underline href="/openings">See all open roles</a>
        </div>
      </div>
      <div className="op-bar">{signUp("bar")}</div>
    </Shell>
  );
}
