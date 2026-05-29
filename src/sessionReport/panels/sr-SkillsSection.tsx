/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Horizontal skill bars + sticky weakest-skill callout.
 * Pure presentation. */

import { t, f, radius } from "../tokens";
import type { Skill } from "../types";
import { SrSectionShell } from "./_primitives";

export function SkillsSection({ skills, weakest }: { skills: Skill[]; weakest: { name: string; tip: string } }) {
  const max = 100;
  const legend = (
    <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 16, height: 4, background: t.indigo, borderRadius: radius.micro }} />
        You
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 2, height: 12, background: t.inkSoft, borderRadius: radius.hairline }} />
        Role Average
      </span>
    </div>
  );
  return (
    <SrSectionShell
      anchorId="ir-section-skills"
      headingId="ir-skills-heading"
      num="03"
      label="Where you stand vs role bar"
      title="Skills Breakdown"
      aside={legend}
    >
      <div className="ir-skills-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {skills.map((s) => {
            const pct = (s.score / max) * 100;
            const avgPct = s.roleAvg ? (s.roleAvg / max) * 100 : null;
            const delta = s.roleAvg ? s.score - s.roleAvg : null;
            return (
              <div key={s.name} className="ir-skill-row" style={{ display: "grid", gridTemplateColumns: "180px 1fr 60px 50px", gap: 14, alignItems: "center" }}>
                <span className="ir-skill-name" style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{s.name}</span>
                <div
                  className="ir-skill-bar-wrap"
                  style={{ background: t.line }}
                  role="progressbar"
                  aria-label={`${s.name} score`}
                  aria-valuenow={s.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={
                    s.roleAvg !== undefined
                      ? `${s.score} out of 100. Role average is ${s.roleAvg}.`
                      : `${s.score} out of 100.`
                  }
                >
                  <div className="ir-skill-bar-bg" style={{ background: t.line }} />
                  <div
                    className="ir-skill-bar-fg"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${t.indigoDeep} 0%, ${t.indigo} 100%)`,
                    }}
                  />
                  {avgPct !== null && (
                    <div className="ir-skill-bar-marker" style={{ left: `calc(${avgPct}% - 1px)` }} aria-hidden="true" />
                  )}
                </div>
                <span className="ir-skill-score" style={{ fontFamily: f.mono, fontSize: 14, color: t.coal, textAlign: "right", fontWeight: 600 }}>
                  {s.score}
                </span>
                <span
                  className="ir-skill-delta"
                  style={{
                    fontFamily: f.mono,
                    fontSize: 12,
                    color: delta === null ? t.inkFaint : delta >= 0 ? t.success : t.error,
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  {delta === null ? "—" : delta >= 0 ? `+${delta}` : delta}
                </span>
              </div>
            );
          })}
        </div>
        <aside
          style={{
            background: t.copperSoft,
            border: `1px solid ${t.copper100}`,
            borderRadius: radius.bar,
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
              Focus on {weakest.name}
            </span>
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.5, margin: "0 0 14px" }}>
            {weakest.tip}
          </p>
          <button type="button" className="ir-cta-primary" style={{ width: "100%", justifyContent: "center" }}>
            Drill this skill
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </aside>
      </div>
    </SrSectionShell>
  );
}
