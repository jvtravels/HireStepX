"use client";

import { useRef } from "react";
import { ChevronRightIcon } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { RequirementSummary } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";

/* Hover-spring transition for the overlapping avatar-initial chip stack
   below — ported from the transitions.dev "avatar-group-hover" pattern
   (https://transitions.dev/detail.html?t=avatar-group-hover). Hovering a
   chip lifts it and gently lifts its neighbors with a power-falloff, then
   the whole stack snaps back with an overshoot spring on mouse-leave.
   Direction-aware easing (clean ease-in on hover, bouncy ease-out on
   return) is what gives it the springy feel — set inline right before the
   --hsx-shift write so each direction's transition picks up the timing
   function current at that moment, rather than sharing one fixed curve. */
const AVATAR_GROUP_LIFT = -4;
const AVATAR_GROUP_SCALE = 1.08;
const AVATAR_GROUP_FALLOFF = 0.45;
const AVATAR_GROUP_EASE_IN = "cubic-bezier(0.22, 1, 0.36, 1)";
const AVATAR_GROUP_EASE_OUT = "cubic-bezier(0.34, 3.85, 0.64, 1)";

const AVATAR_GROUP_STYLE = `
.hsx-avatar {
  transform-origin: center;
  transform: translateY(var(--hsx-shift, 0px)) scale(var(--hsx-scale-active, 1));
  transition: transform 320ms ${AVATAR_GROUP_EASE_IN};
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .hsx-avatar { transition: none !important; transform: none !important; }
}
`;

/** "Strong Match" cell — overlapping avatar-initial chips for the candidates
    scoring at/above STRONG_MATCH_THRESHOLD. Hovering the chip stack shows a
    dark "Strong Matches" card (matches the canvas reference) listing each
    real candidate's name, years of experience, and skills — no fabricated
    data; candidates beyond the ones we have full profiles for are summed
    into a trailing "+N more" line using the real count. The group's average
    score is shown under Top Matches instead, since strongAvgScore is the
    average across that same top-matches group. */
export default function StrongMatchCell({ aiScreening }: { aiScreening: RequirementSummary["aiScreening"] }) {
  const groupRef = useRef<HTMLButtonElement>(null);

  const setAvatarShifts = (activeIdx: number | null, phase: "in" | "out") => {
    const root = groupRef.current;
    if (!root) return;
    const tf = phase === "out" ? AVATAR_GROUP_EASE_OUT : AVATAR_GROUP_EASE_IN;
    root.querySelectorAll<HTMLElement>(".hsx-avatar").forEach((el, i) => {
      el.style.transitionTimingFunction = tf;
      if (activeIdx == null) {
        el.style.setProperty("--hsx-shift", "0px");
        el.style.setProperty("--hsx-scale-active", "1");
        return;
      }
      const d = Math.abs(i - activeIdx);
      el.style.setProperty("--hsx-shift", `${(AVATAR_GROUP_LIFT * Math.pow(AVATAR_GROUP_FALLOFF, d)).toFixed(3)}px`);
      el.style.setProperty("--hsx-scale-active", i === activeIdx ? String(AVATAR_GROUP_SCALE) : "1");
    });
  };

  if (aiScreening.evaluated === 0) return <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>—</span>;
  if (aiScreening.strongMatches.length === 0) {
    return <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>None yet</span>;
  }
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          ref={groupRef}
          type="button"
          aria-label={`${aiScreening.topMatches} strong match${aiScreening.topMatches === 1 ? "" : "es"} — view candidates`}
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: 10, margin: -10, cursor: "pointer" }}
          onMouseLeave={() => setAvatarShifts(null, "out")}
        >
          <style>{AVATAR_GROUP_STYLE}</style>
          {aiScreening.strongMatches.map((candidate, i) => (
            <span
              key={candidate.id}
              className="hsx-avatar"
              onMouseEnter={() => setAvatarShifts(i, "in")}
              style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.indigoDeep, background: t.indigo100, border: `2px solid ${t.white}`,
                marginLeft: i === 0 ? 0 : -9,
              }}
            >
              {candidate.initials}
            </span>
          ))}
          {aiScreening.strongMatchExtra > 0 && (
            <span
              className="hsx-avatar"
              onMouseEnter={() => setAvatarShifts(aiScreening.strongMatches.length, "in")}
              style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.inkSoft, background: t.creamSoft, border: `2px solid ${t.white}`,
                marginLeft: -9,
              }}
            >
              +{aiScreening.strongMatchExtra}
            </span>
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        style={{ width: 288, maxWidth: "calc(100vw - 32px)", borderRadius: 12, border: `1px solid ${t.creamLine}`, background: t.coal, padding: 14, boxShadow: `0 12px 32px ${t.coalShadow}` }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: t.white, opacity: 0.6 }}>
            Strong Matches
          </span>
          <span
            style={{
              width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.coal, background: t.white,
            }}
          >
            {aiScreening.topMatches}
          </span>
        </div>
        <div style={{ marginTop: 10, borderTop: `1px solid ${t.creamLine}`, display: "flex", flexDirection: "column" }}>
          {aiScreening.strongMatches.filter((candidate) => candidate.name).map((candidate, i, arr) => (
            <div
              key={candidate.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${t.creamLine}` : "none",
              }}
            >
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {candidate.name}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.white, opacity: 0.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[candidate.yearsExperience != null ? `${candidate.yearsExperience} yrs` : null, ...candidate.skills.slice(0, 2)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <ChevronRightIcon size={14} color={t.white} style={{ opacity: 0.25, flexShrink: 0 }} aria-hidden="true" />
            </div>
          ))}
          {aiScreening.strongMatchExtra > 0 && (
            <div style={{ padding: "10px 0 0", fontFamily: f.sans, fontSize: textSize.sm, color: t.white, opacity: 0.55 }}>
              +{aiScreening.strongMatchExtra} more {aiScreening.strongMatchExtra === 1 ? "match" : "matches"}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}