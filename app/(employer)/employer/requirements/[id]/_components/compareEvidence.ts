import { useEffect, useMemo, useState } from "react";
import type { Candidate } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { getEvidence } from "@/employer/_requirementCalls";
import { candidateDisplayName } from "./requirementFormat";
import { metricLeaders, type CompareMetric } from "./compareInsights";

export type EvidenceState =
  | { status: "locked" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; evidence: CandidateEvidence };

export const READINESS_LABEL = { strongHire: "Strong hire", hire: "Hire", leanHire: "Lean hire" } as const;
const READINESS_RANK = { leanHire: 1, hire: 2, strongHire: 3 } as const;

/** Locked candidates are never fetched: their evidence stays closed until the employer unlocks them from the shortlist. */
export function useCompareEvidence(chosen: Candidate[]): Map<string, EvidenceState> {
  const [fetched, setFetched] = useState<Map<string, EvidenceState>>(new Map());
  const unlockedIds = chosen.filter((c) => c.unlocked).map((c) => c.id);
  const key = unlockedIds.join(",");

  useEffect(() => {
    let active = true;
    const ids = key ? key.split(",") : [];
    ids.forEach((id) => {
      getEvidence(id).then((res) => {
        if (!active) return;
        setFetched((prev) => new Map(prev).set(id, res.ok ? { status: "ready", evidence: res.data } : { status: "error" }));
      });
    });
    return () => {
      active = false;
    };
  }, [key]);

  return useMemo(
    () => new Map(chosen.map((c) => [c.id, !c.unlocked ? { status: "locked" } : (fetched.get(c.id) ?? { status: "loading" })] as [string, EvidenceState])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chosen only matters through its ids and unlock flags, which `key` and `fetched` cover.
    [key, fetched],
  );
}

function evidenceOf(states: Map<string, EvidenceState>, id: string): CandidateEvidence | null {
  const s = states.get(id);
  return s?.status === "ready" ? s.evidence : null;
}

/** The candidate who clearly leads on a figure the evidence carries; empty when fewer than two have it or the top is tied. */
export function evidenceLeaders(chosen: Candidate[], states: Map<string, EvidenceState>) {
  const pick = (value: (e: CandidateEvidence) => number | null, minGap: number): Set<string> => {
    const rows = chosen.flatMap((c) => {
      const e = evidenceOf(states, c.id);
      const v = e ? value(e) : null;
      return v === null ? [] : [{ id: c.id, v }];
    });
    if (rows.length < 2) return new Set<string>();
    const sorted = [...rows].sort((a, b) => b.v - a.v);
    return sorted[0].v - sorted[1].v >= minGap ? new Set([sorted[0].id]) : new Set<string>();
  };
  return {
    readiness: pick((e) => (e.readiness ? READINESS_RANK[e.readiness.band] : null), 1),
    star: pick((e) => (e.starCompleteness ? e.starCompleteness.pct : null), 15),
  };
}

const METRIC_REASON: Record<CompareMetric, string> = { match: "job match", skills: "required skills", interview: "interview score", sessions: "practice" };

export interface Verdict {
  /** One plain sentence: who to interview first, or that nobody clearly leads. */
  headline: string;
  /** What is missing or worth confirming; null when nothing is. */
  detail: string | null;
  /** True while evidence for an unlocked candidate is still loading, so the sentence may change. */
  pending: boolean;
}

function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A plain-language read of the comparison. It reports where candidates differ and where evidence is missing; it never ranks people into a hire decision. */
export function buildVerdict(chosen: Candidate[], required: string[], states: Map<string, EvidenceState>): Verdict {
  const reasons = new Map<string, string[]>(chosen.map((c) => [c.id, []]));
  (["match", "interview", "skills", "sessions"] as CompareMetric[]).forEach((m) => {
    const [id] = metricLeaders(chosen, required, m);
    if (id) reasons.get(id)?.push(METRIC_REASON[m]);
  });
  const lead = evidenceLeaders(chosen, states);
  const [readinessId] = lead.readiness;
  if (readinessId) reasons.get(readinessId)?.push("hire readiness");
  const [starId] = lead.star;
  if (starId) reasons.get(starId)?.push("answer structure");

  const ranked = chosen.map((c) => ({ c, n: reasons.get(c.id)?.length ?? 0 })).sort((a, b) => b.n - a.n);
  const top = ranked[0];
  const clear = top && top.n > 0 && top.n > (ranked[1]?.n ?? 0);
  const name = (c: Candidate) => candidateDisplayName(c);

  const headline = clear
    ? `${name(top.c)} is the stronger pick to interview first, ahead on ${joinList(reasons.get(top.c.id) ?? [])}.`
    : top && top.n > 0
      ? "No candidate is clearly ahead. Each leads on different things, so use the interview to separate them."
      : "These candidates look alike on every measure we compare, so use the interview to separate them.";

  const noEvidence = chosen.filter((c) => {
    const s = states.get(c.id);
    if (s?.status === "ready") return !s.evidence.readiness && !s.evidence.starCompleteness && s.evidence.skills.length === 0;
    return s?.status === "error" || s?.status === "locked" ? false : c.sessionsCompleted === 0;
  });
  const locked = chosen.filter((c) => !c.unlocked);
  const parts: string[] = [];
  if (noEvidence.length > 0) parts.push(`${joinList(noEvidence.map(name))} ${noEvidence.length === 1 ? "has" : "have"} no graded interview yet, so ask for a practice session or a work sample first.`);
  if (locked.length > 0) parts.push(`Unlock ${joinList(locked.map(name))} from the shortlist to see their evidence.`);

  const pending = chosen.some((c) => states.get(c.id)?.status === "loading");
  return { headline, detail: parts.length > 0 ? parts.join(" ") : null, pending };
}
