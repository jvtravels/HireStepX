"use client";
import { useEffect, useState } from "react";
import { Close, Shell } from "./Pages";
import { delay, useReveal } from "./motion";

type Member = { name: string; role: string; city: string; bio: string; photo?: string; linkedin?: string; x?: string };

const TEAM: Member[] = [
  { name: "[Full name]", role: "[Role]", city: "[City]", bio: "[One or two honest lines: where you come from and why you work on interview practice.]" },
  { name: "[Full name]", role: "[Role]", city: "[City]", bio: "[One or two honest lines: where you come from and why you work on interview practice.]" },
  { name: "[Full name]", role: "[Role]", city: "[City]", bio: "[One or two honest lines: where you come from and why you work on interview practice.]" },
];

type Stats = { users: number | null; sessions: number | null; companies: number | null; jobs: number | null };

const useStats = (): Stats => {
  const [stats, setStats] = useState<Stats>({ users: null, sessions: null, companies: null, jobs: null });
  useEffect(() => {
    fetch("/api/platform-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { userCount?: number | null; sessionCount?: number | null; companyCount?: number | null; jobCount?: number | null } | null) => {
        if (d) setStats({ users: d.userCount ?? null, sessions: d.sessionCount ?? null, companies: d.companyCount ?? null, jobs: d.jobCount ?? null });
      })
      .catch(() => { /* leave the dashes in place */ });
  }, []);
  return stats;
};

const fmt = (n: number | null) => (n === null ? "-" : `${n.toLocaleString("en-IN")}+`);

const initials = (name: string) => {
  const parts = name.replace(/[[\]]/g, "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
};

const aboutCss = `
.ab-hero { padding: 88px 0 0; }
.ab-hero-g { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 64px; align-items: center; }
.ab-hero-g > * { min-width: 0; }
.ab-hero .hx-kicker { display: block; }
.ab-h1 { margin: 16px 0 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 60px; line-height: 1.04; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; color: var(--ink); }
.ab-lede { margin: 20px 0 0; max-width: 46ch; font-size: 18px; line-height: 1.55; color: var(--ink-2); text-wrap: pretty; }
.ab-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.ab-stage { padding: 44px; border-radius: 28px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); }
.ab-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.ab-tile { background: var(--white); border: 1px solid var(--line); border-radius: 16px; padding: 24px 22px 22px; display: grid; gap: 12px; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 12px 24px -8px oklch(0.2 0.03 280 / 0.08); }
.ab-tile b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: var(--ink); font-variant-numeric: tabular-nums; }
.ab-tile b.na { color: var(--ink-3); }
.ab-tile span { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.ab-stat-note { margin: 16px 0 0; font-size: 13px; color: var(--ink-2); text-align: center; }
.ab-team { padding: 112px 0 120px; }
.ab-team-h { max-width: 560px; }
.ab-team-h h2 { margin: 14px 0 0; }
.ab-team-sub { margin: 12px 0 0; font-size: 17px; line-height: 1.55; color: var(--ink-2); }
.ab-grid { margin-top: 48px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; }
.ab-grid > * { min-width: 0; }
.ab-mem { display: grid; gap: 18px; align-content: start; }
.ab-ph { position: relative; aspect-ratio: 4 / 4.4; border-radius: 20px; overflow: hidden; border: 1px solid var(--line); display: grid; place-items: center; background: linear-gradient(135deg, oklch(0.945 0.04 55), oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285)); }
.ab-mem:nth-child(2) .ab-ph { background: linear-gradient(135deg, oklch(0.935 0.045 285), oklch(0.95 0.035 320) 55%, oklch(0.945 0.04 55)); }
.ab-mem:nth-child(3) .ab-ph { background: linear-gradient(200deg, oklch(0.95 0.035 320), oklch(0.945 0.04 55) 50%, oklch(0.935 0.045 285)); }
.ab-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ab-ph b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 48px; font-weight: 500; letter-spacing: -0.02em; color: var(--ink-3); }
.ab-mem h3 { margin: 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 24px; line-height: 1.2; font-weight: 600; letter-spacing: -0.015em; color: var(--ink); }
.ab-meta { display: block; margin-top: 4px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.ab-mem p { margin: 10px 0 0; font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.ab-links { display: flex; gap: 16px; margin-top: 12px; font-size: 14px; font-weight: 500; }
.ab-links a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
@container (max-width: 900px) {
  .ab-hero { padding-top: 48px; }
  .ab-hero-g { grid-template-columns: minmax(0, 1fr); gap: 40px; }
  .ab-h1 { font-size: 38px; }
  .ab-lede { font-size: 16px; }
  .ab-stage { padding: 20px; border-radius: 20px; }
  .ab-tile b { font-size: 34px; }
  .ab-tile { padding: 18px 16px; }
  .ab-team { padding: 64px 0 72px; }
  .ab-grid { grid-template-columns: minmax(0, 1fr); gap: 36px; margin-top: 32px; }
  .ab-ph { aspect-ratio: 4 / 3; }
}
`;

export function AboutPage() {
  const hero = useReveal<HTMLDivElement>();
  const team = useReveal<HTMLDivElement>();
  const counts = useStats();

  return (
    <Shell active="talent">
      <style>{aboutCss}</style>
      <section className="ab-hero">
        <div ref={hero.ref} className={`hx-wrap hx-rv${hero.on ? " on" : ""}`}>
          <div className="ab-hero-g">
            <div>
              <span className="hx-kicker hx-ri" style={delay(0)}>About us</span>
              <h1 className="ab-h1 hx-ri" style={delay(1)}>Built in Mumbai to help India get hired on proof.</h1>
              <p className="ab-lede hx-ri" style={delay(2)}>HireStepX is where candidates practise interviews out loud, and where companies find people who have already shown what they can do.</p>
              <div className="ab-cta hx-ri" style={delay(3)}>
                <a data-no-underline className="hx-btn lg" href="/signup">Start for free</a>
                <a data-no-underline className="hx-btn lg alt" href="/contact">Book a demo with a founder</a>
              </div>
            </div>
            <div className="ab-stage hx-ri" style={delay(3)}>
              <div className="ab-tiles">
                {([[counts.users, "People practising"], [counts.sessions, "Interviews practised"], [counts.companies, "Companies hiring"], [counts.jobs, "Roles posted"]] as [number | null, string][]).map(([n, label]) => (
                  <div className="ab-tile" key={label}>
                    <b className={n === null ? "na" : ""}>{fmt(n)}</b>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="ab-stat-note">Live totals, rounded down. Updated hourly.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ab-team">
        <div ref={team.ref} className={`hx-wrap hx-rv${team.on ? " on" : ""}`}>
          <div className="ab-team-h">
            <span className="hx-kicker hx-ri" style={delay(0)}>Our team</span>
            <h2 className="hx-h2 hx-ri" style={delay(1)}>The people behind HireStepX.</h2>
            <p className="ab-team-sub hx-ri" style={delay(2)}>Real people read your feedback and build what you ask for. Write to us at hello@hirestepx.com.</p>
          </div>
          <div className="ab-grid">
            {TEAM.map((m, i) => (
              <article className="ab-mem hx-ri" style={delay(3 + i)} key={i}>
                <div className="ab-ph">
                  {m.photo ? <img src={m.photo} alt={m.name} /> : <b aria-hidden="true">{initials(m.name)}</b>}
                </div>
                <div>
                  <h3>{m.name}</h3>
                  <span className="ab-meta">{m.role} · {m.city}</span>
                  <p>{m.bio}</p>
                  {(m.linkedin || m.x) && (
                    <div className="ab-links">
                      {m.linkedin && <a href={m.linkedin}>LinkedIn</a>}
                      {m.x && <a href={m.x}>X</a>}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Close
        kicker="Talk to us"
        title="Meet the founders, or start on your own."
        body="Book a demo with a founder and we will walk you through HireStepX, or create a free account and run your first interview today."
        primary={["Start for free", "/signup"]}
        secondary={["Book a demo with a founder", "/contact"]}
      />
    </Shell>
  );
}
