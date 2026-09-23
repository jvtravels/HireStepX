/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Thumbs feedback + reason tags + trust/usefulness 2-question polls.
 * Pure presentation. */

import { useState } from "react";
import { t, f } from "../tokens";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function FooterSection({
  onTrustAnswer,
  onUsefulAnswer,
}: {
  onTrustAnswer?: (value: "yes" | "no") => void;
  onUsefulAnswer?: (value: "yes" | "no") => void;
}) {
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [trust, setTrust] = useState<"yes" | "no" | null>(null);
  const [useful, setUseful] = useState<"yes" | "no" | null>(null);
  const reasons = thumb === "down"
    ? ["Score felt too harsh", "Score felt too generous", "Feedback was vague", "Wrong about my answer"]
    : ["The score felt fair", "Coaching was specific", "I'll try the retry CTA"];
  return (
    <footer
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "8px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          Your data is private and secure.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          Was this report helpful?
          <ToggleGroup
            type="single"
            value={thumb ?? ""}
            onValueChange={(v) => { setThumb((v as "up" | "down") || null); setReason(null); }}
            aria-label="Was this report helpful?"
          >
            <ToggleGroupItem value="up" aria-label="Helpful">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </ToggleGroupItem>
            <ToggleGroupItem value="down" aria-label="Not helpful">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
              </svg>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {thumb && (
        <div
          className="ir-feedback-row"
          style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}
        >
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
            {thumb === "down" ? "What was off?" : "What worked?"}
          </span>
          <ToggleGroup
            type="single"
            value={reason ?? ""}
            onValueChange={(v) => setReason(v || null)}
            aria-label={thumb === "down" ? "What was off?" : "What worked?"}
          >
            {reasons.map((r) => (
              <ToggleGroupItem key={r} value={r}>
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {reason && (
            <span style={{ fontFamily: f.sans, fontSize: 11, color: t.success, fontWeight: 500 }}>
              ✓ Thanks — recorded
            </span>
          )}
        </div>
      )}
      <div className="ir-poll-row" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 6, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Did this score feel fair?</span>
          <ToggleGroup
            type="single"
            value={trust ?? ""}
            onValueChange={(v) => { if (!v) return; setTrust(v as "yes" | "no"); onTrustAnswer?.(v as "yes" | "no"); }}
            aria-label="Did this score feel fair?"
          >
            <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
            <ToggleGroupItem value="no">No</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Will you act on this feedback?</span>
          <ToggleGroup
            type="single"
            value={useful ?? ""}
            onValueChange={(v) => { if (!v) return; setUseful(v as "yes" | "no"); onUsefulAnswer?.(v as "yes" | "no"); }}
            aria-label="Will you act on this feedback?"
          >
            <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
            <ToggleGroupItem value="no">No</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </footer>
  );
}
