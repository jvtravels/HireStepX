"use client";
import { tokens as t, fonts as f } from "./auth/_tokens";

export type MatchFactorLevel = "strong" | "partial" | "gap";
export interface MatchFactor {
  key: "role" | "skills" | "location" | "experience";
  label: string;
  level: MatchFactorLevel;
  detail: string;
}
export interface MatchFactors {
  factors: MatchFactor[];
  matchedSkills: string[];
  missingSkills: string[];
}

const LEVEL_STYLE: Record<MatchFactorLevel, { label: string; color: string; background: string }> = {
  strong: { label: "Strong", color: t.successInk, background: t.success100 },
  partial: { label: "Partial", color: t.warningInk, background: t.warning100 },
  gap: { label: "Gap", color: t.inkSoft, background: t.creamSoft },
};

const HEADING = { fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: "0 0 8px" } as const;
const LIST = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } as const;
const ROW = { display: "flex", alignItems: "center", gap: 10, fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.4 } as const;
const CHIP_BASE = { fontFamily: f.sans, fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, flexShrink: 0, minWidth: 54, textAlign: "center" } as const;
const chip = (color: string, background: string) => ({ ...CHIP_BASE, color, background });
const FACTOR_LABEL = { fontWeight: 600, color: t.coal } as const;
const SKILLS = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } as const;
const SKILL_BASE = { fontFamily: f.sans, fontSize: 12.5, padding: "4px 10px", borderRadius: 999 } as const;
const SKILL_YES = { ...SKILL_BASE, color: t.successInk, background: t.success100 } as const;
const SKILL_NO = { ...SKILL_BASE, color: t.inkSoft, background: t.cream, border: `1px dashed ${t.line}` } as const;
const HINT = { fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, margin: "8px 0 0", lineHeight: 1.5 } as const;

export function MatchFactorsCard({ data }: { data: MatchFactors }) {
  if (data.factors.length === 0) return null;
  return (
    <section aria-label="Why you matched">
      <h2 style={HEADING}>Why you matched</h2>
      <ul style={LIST}>
        {data.factors.map((x) => {
          const s = LEVEL_STYLE[x.level];
          return (
            <li key={x.key} style={ROW}>
              <span style={chip(s.color, s.background)}>{s.label}</span>
              <span>
                <span style={FACTOR_LABEL}>{x.label}</span> {x.detail}
              </span>
            </li>
          );
        })}
      </ul>
      {(data.matchedSkills.length > 0 || data.missingSkills.length > 0) && (
        <div style={SKILLS} aria-label="Skill overlap">
          {data.matchedSkills.map((s) => (
            <span key={`y-${s}`} style={SKILL_YES}>{s}</span>
          ))}
          {data.missingSkills.map((s) => (
            <span key={`n-${s}`} style={SKILL_NO} title="Not on your resume yet">{s}</span>
          ))}
        </div>
      )}
      {data.missingSkills.length > 0 && (
        <p style={HINT}>Dashed skills are not on your resume yet. Practising them in a mock interview adds verified evidence employers can see.</p>
      )}
    </section>
  );
}

export function EmployerVisibilityCard({ unlocked }: { unlocked: boolean }) {
  return (
    <section aria-label="What the employer sees">
      <h2 style={HEADING}>What this employer sees</h2>
      <ul style={LIST}>
        <li style={ROW}>
          <span style={chip(t.successInk, t.success100)}>Visible</span>
          <span>Your practice scores, skills and interview summary for this role</span>
        </li>
        <li style={ROW}>
          <span style={chip(unlocked ? t.successInk : t.inkSoft, unlocked ? t.success100 : t.creamSoft)}>
            {unlocked ? "Visible" : "Hidden"}
          </span>
          <span>{unlocked ? "Your name and contact details, since they showed interest" : "Your name and contact details, until they unlock your profile"}</span>
        </li>
        <li style={ROW}>
          <span style={chip(unlocked ? t.successInk : t.inkSoft, unlocked ? t.success100 : t.creamSoft)}>
            {unlocked ? "Visible" : "Hidden"}
          </span>
          <span>{unlocked ? "Your answers and the notes on them" : "Your spoken answers, which are never shared before an unlock"}</span>
        </li>
      </ul>
      <p style={HINT}>You can switch employer visibility off at any time in Settings.</p>
    </section>
  );
}
