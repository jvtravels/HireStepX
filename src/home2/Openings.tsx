"use client";
import { useEffect } from "react";
import { captureClientEvent } from "../posthogClient";
import { Arrow, Close, Shell } from "./Pages";
import {
  experienceLabel, practiseHref, WORK_MODE_LABEL, type PublicOpening,
} from "../../server-handlers/_public-openings-helpers";

/* Copy that makes a promise to candidates lives in one place so it can be reviewed in one read. */
const TRUST = {
  anonymous: "Employers stay private until you have practised and chosen to share your profile.",
  posted: "Posted by an employer on HireStepX.",
  noApply: "Signing up does not apply you. Employers read your scored answers.",
} as const;

const openingsCss = `
.op-head { padding: 96px 0 40px; text-align: center; }
.op-head .hx-h1 { margin-top: 14px; }
.op-head .hx-lede { max-width: 56ch; }
.op-trust { margin: 16px auto 0; max-width: 62ch; font-size: 14px; line-height: 1.5; color: var(--ink-3); text-wrap: pretty; }
.op-facts { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 0; }
.op-head .op-facts { justify-content: center; margin-top: 24px; }
.op-facts li { font-size: 13px; font-weight: 500; color: var(--ink-2); padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--white); }
.op-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
.op-card { display: flex; flex-direction: column; gap: 10px; height: 100%; padding: 24px; border-radius: 16px; border: 1px solid var(--line); background: var(--white); transition: border-color .15s, background .15s; }
.op-card:hover { border-color: var(--btn); background: var(--wash); }
.op-card h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 22px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 600; }
.op-card p { font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.op-card .op-facts { margin-top: auto; padding-top: 6px; }
.op-more .hx-arr { width: 14px; height: 14px; flex: none; }
.op-grid:has(> li:only-child) { max-width: 440px; margin-inline: auto; }
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
@container (max-width: 720px) {
  .op-head { padding: 56px 0 28px; }
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
  useEffect(() => { captureClientEvent("openings_list_view", { count: openings.length }); }, [openings.length]);
  return (
    <Shell active="openings">
      <style>{openingsCss}</style>
      <section className="op-head">
        <div className="hx-wrap">
          <span className="hx-kicker">Open roles</span>
          <h1 className="hx-h1">Roles hiring on <b>HireStepX</b></h1>
          <p className="hx-lede">Employers list roles here without a company name. Practise for the one you want, and your scored answers do the talking.</p>
          <p className="op-trust">{TRUST.posted} {TRUST.anonymous}</p>
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
            <ul className="op-grid">
              {openings.map((o) => (
                <li key={o.slug}>
                  <a data-no-underline className="op-card" href={`/openings/${o.slug}`}
                    onClick={() => captureClientEvent("openings_card_click", { opening: o.slug })}>
                    <h2>{o.title}</h2>
                    <p>{o.summary}</p>
                    <Facts o={o} />
                    <span className="op-more">View role <Arrow /></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  );
}

export function OpeningDetailPage({ opening: o, url }: { opening: PublicOpening; url: string }) {
  useEffect(() => { captureClientEvent("opening_view", { opening: o.slug }); }, [o.slug]);
  const share = `https://wa.me/?text=${encodeURIComponent(`${o.title}, hiring on HireStepX: ${url}`)}`;
  return (
    <Shell active="openings">
      <style>{openingsCss}</style>
      <section className="op-head">
        <div className="hx-wrap">
          <span className="hx-kicker">Hiring on HireStepX</span>
          <h1 className="hx-h1">{o.title}</h1>
          <p className="hx-lede">{o.summary}</p>
          <Facts o={o} />
          <div className="op-cta">
            <a data-no-underline className="hx-btn lg" href={practiseHref(o)}
              onClick={() => captureClientEvent("opening_practise_click", { opening: o.slug, role: o.title })}>
              Practise for this role <Arrow />
            </a>
            <a data-no-underline className="hx-btn lg alt" href={share} target="_blank" rel="noopener noreferrer"
              onClick={() => captureClientEvent("opening_share_click", { opening: o.slug, channel: "whatsapp" })}>
              Share on WhatsApp
            </a>
          </div>
        </div>
      </section>
      <div className="hx-wrap">
        <div className="op-body">
          {o.skills.length > 0 && (
            <div>
              <h2>What this role is likely to test</h2>
              <p className="op-lead">Your practice interview for this role leans on these skills.</p>
              <ul className="op-facts">{o.skills.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          <div>
            <h2>How it works</h2>
            <ol className="op-steps">
              <li>Sign up and start a practice interview set up for this role. No credit card needed.</li>
              <li>Get a scored report with a STAR breakdown and a coached model answer.</li>
              <li>Choose whether to share your profile. Employers only see what you share.</li>
            </ol>
          </div>
          <div>
            <p className="op-note">{TRUST.posted} {TRUST.anonymous} {TRUST.noApply}</p>
            <p className="op-note op-note2">
              <a href={`/contact?topic=report-listing&opening=${encodeURIComponent(o.slug)}`}>Report this listing</a>
              {" · "}
              <a href="/openings">All open roles</a>
            </p>
          </div>
        </div>
      </div>
      <Close kicker="Ready?" title="Practise first, get seen second" body="Your scored answers are what employers read. Start with a free practice interview for this role." primary={["Practise for this role", practiseHref(o)]} />
    </Shell>
  );
}
