import { useRef } from "react";
import { tokens as t, fonts as f } from "@/auth/_tokens";

export type CandidateTabKey = "overview" | "practice" | "resume";

export const CANDIDATE_TABS: Array<{ key: CandidateTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "practice", label: "Practice & communication" },
  { key: "resume", label: "Resume & portfolio" },
];

export const tabId = (k: CandidateTabKey) => `candidate-tab-${k}`;
export const panelId = (k: CandidateTabKey) => `candidate-panel-${k}`;

/** WAI-ARIA tabs: roving tabindex, Left/Right/Home/End, selection follows focus. */
export function CandidateTabs({ active, onChange, phone }: { active: CandidateTabKey; onChange: (k: CandidateTabKey) => void; phone: boolean }) {
  const refs = useRef<Partial<Record<CandidateTabKey, HTMLButtonElement | null>>>({});

  const move = (index: number) => {
    const next = CANDIDATE_TABS[(index + CANDIDATE_TABS.length) % CANDIDATE_TABS.length].key;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Candidate profile sections"
      style={{ display: "flex", gap: 4, borderBottom: `1px solid ${t.line}`, margin: "20px 0", overflowX: "auto" }}
    >
      {CANDIDATE_TABS.map((tb, i) => {
        const selected = active === tb.key;
        return (
          <button
            key={tb.key}
            ref={(el) => {
              refs.current[tb.key] = el;
            }}
            id={tabId(tb.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(tb.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tb.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(i + 1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); move(i - 1); }
              else if (e.key === "Home") { e.preventDefault(); move(0); }
              else if (e.key === "End") { e.preventDefault(); move(CANDIDATE_TABS.length - 1); }
            }}
            className="pointer-coarse:min-h-11"
            style={{
              padding: phone ? "12px 14px" : "10px 18px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              border: "none",
              borderRadius: "10px 10px 0 0",
              background: selected ? t.indigo : "transparent",
              color: selected ? t.white : t.neutralInk,
              fontFamily: f.sans,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tb.label}
          </button>
        );
      })}
    </div>
  );
}
