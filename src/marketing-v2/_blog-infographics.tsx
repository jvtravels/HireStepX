/* HireStepX — Blog infographics
   Inline visual components for structured blog data.
   Brand: copper/cream/coal palette, Satoshi + Instrument Serif.
   No external deps — pure React JSX with inline styles. */

import { tokens as t, fonts } from "../auth/_tokens";

/* ── Interview Round Flow ───────────────────────────────────────── */
interface Round {
  label: string;
  duration?: string;
  detail: string;
}

export function RoundFlow({ rounds }: { rounds: Round[] }) {
  return (
    <div style={{
      margin: "24px 0",
      padding: "20px 16px 16px",
      background: t.creamSoft,
      border: `1px solid ${t.line}`,
      borderRadius: 12,
      overflowX: "auto",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        minWidth: `${rounds.length * 116}px`,
      }}>
        {rounds.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              padding: "0 4px",
              gap: 5,
            }}>
              {/* Number circle */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: t.copper, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: fonts.sans, fontSize: 12, fontWeight: 700,
                flexShrink: 0,
              }}>{i + 1}</div>
              {/* Label */}
              <div style={{
                fontFamily: fonts.sans, fontSize: 11, fontWeight: 700,
                color: t.coal, textAlign: "center", lineHeight: 1.3,
              }}>{r.label}</div>
              {/* Duration badge */}
              {r.duration && (
                <div style={{
                  fontFamily: fonts.sans, fontSize: 9, fontWeight: 700,
                  color: t.copper, letterSpacing: "0.04em",
                  background: t.copper100, borderRadius: 99,
                  padding: "2px 6px",
                }}>{r.duration}</div>
              )}
              {/* Detail */}
              <div style={{
                fontFamily: fonts.sans, fontSize: 10, color: t.inkSoft,
                textAlign: "center", lineHeight: 1.45,
              }}>{r.detail}</div>
            </div>
            {/* Connector */}
            {i < rounds.length - 1 && (
              <div style={{
                flexShrink: 0, width: 18, paddingTop: 10,
                color: t.copper, fontSize: 14, textAlign: "center",
                opacity: 0.6,
              }}>›</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Salary Ladder ───────────────────────────────────────────────── */
interface SalaryRow {
  role: string;
  min: number;
  max: number;
  note?: string;
}

export function SalaryLadder({
  rows,
  maxLPA,
  caption,
}: {
  rows: SalaryRow[];
  maxLPA: number;
  caption?: string;
}) {
  return (
    <div style={{
      margin: "24px 0",
      padding: "20px 24px 16px",
      background: t.creamSoft,
      border: `1px solid ${t.line}`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map((r, i) => {
          const minPct = Math.round((r.min / maxLPA) * 100);
          const maxPct = Math.round((r.max / maxLPA) * 100);
          const sameVal = r.min === r.max;
          const rangeLabel = sameVal ? `₹${r.max} LPA` : `₹${r.min}–${r.max} LPA`;
          return (
            <div key={i}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: 6,
              }}>
                <span style={{
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal,
                }}>{r.role}</span>
                <span style={{
                  fontFamily: fonts.sans, fontSize: 11, color: t.inkSoft,
                  flexShrink: 0, marginLeft: 16,
                }}>
                  {rangeLabel}{r.note ? ` · ${r.note}` : ""}
                </span>
              </div>
              {/* Track */}
              <div style={{ height: 5, background: t.line, borderRadius: 3, position: "relative" }}>
                <div style={{
                  position: "absolute",
                  left: `${minPct}%`,
                  /* Ensure range bars have a visible min width */
                  width: sameVal ? `${maxPct}%` : `max(${maxPct - minPct}%, 4px)`,
                  height: "100%",
                  background: t.copper,
                  borderRadius: 3,
                  opacity: 1 - i * 0.07,
                }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        fontFamily: fonts.sans, fontSize: 10, color: t.inkFaintWeak,
        marginTop: 14, display: "flex", justifyContent: "space-between",
      }}>
        <span>₹0</span>
        <span style={{ textAlign: "center" }}>{caption ?? "Indicative 2026 ranges"}</span>
        <span>₹{maxLPA} LPA</span>
      </div>
    </div>
  );
}

/* ── Tier Compare Cards ──────────────────────────────────────────── */
interface TierCardData {
  tier: string;
  examples: string;
  rows: { label: string; range: string }[];
}

export function TierCompare({ cards }: { cards: TierCardData[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${Math.min(cards.length, 3)}, 1fr)`,
      gap: 12,
      margin: "24px 0",
    }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          padding: "16px 18px",
          background: t.creamSoft,
          border: `1px solid ${t.line}`,
          borderTop: `3px solid ${t.copper}`,
          borderRadius: 10,
        }}>
          <div style={{
            fontFamily: fonts.sans, fontSize: 10, fontWeight: 700,
            color: t.copper, textTransform: "uppercase", letterSpacing: "0.09em",
            marginBottom: 4,
          }}>{c.tier}</div>
          <div style={{
            fontFamily: fonts.sans, fontSize: 10, color: t.inkFaint,
            marginBottom: 14, lineHeight: 1.4,
          }}>{c.examples}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {c.rows.map((r, j) => (
              <div key={j}>
                <div style={{
                  fontFamily: fonts.sans, fontSize: 10, color: t.inkSoft,
                  marginBottom: 2,
                }}>{r.label}</div>
                <div style={{
                  fontFamily: fonts.sans, fontSize: 14, fontWeight: 700,
                  color: t.coal, lineHeight: 1.2,
                }}>{r.range}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Framework Steps ─────────────────────────────────────────────── */
interface FrameworkStep {
  number: string;
  label: string;
  hint: string;
}

export function FrameworkSteps({ steps }: { steps: FrameworkStep[] }) {
  return (
    <div style={{
      margin: "24px 0",
      border: `1px solid ${t.line}`,
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          padding: "16px 20px",
          background: i % 2 === 0 ? t.cream : t.creamSoft,
          borderBottom: i < steps.length - 1 ? `1px solid ${t.line}` : "none",
        }}>
          <div style={{
            fontFamily: fonts.sans, fontSize: 11, fontWeight: 700,
            color: t.copper, flexShrink: 0, minWidth: 22, paddingTop: 1,
            letterSpacing: "0.02em",
          }}>{s.number}</div>
          <div>
            <div style={{
              fontFamily: fonts.sans, fontSize: 13, fontWeight: 700,
              color: t.coal, marginBottom: 3,
            }}>{s.label}</div>
            <div style={{
              fontFamily: fonts.sans, fontSize: 12, color: t.inkSoft,
              lineHeight: 1.55,
            }}>{s.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
