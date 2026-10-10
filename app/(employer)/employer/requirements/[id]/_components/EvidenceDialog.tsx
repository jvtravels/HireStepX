"use client";

import { useCallback, useEffect, useState } from "react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { OutlineCta } from "@/employer/_atoms";
import { IdentityHiddenBadge, InlineNotice } from "@/employer/_requirementAtoms";
import { failureMessage, getEvidence, type EvidenceResponse } from "@/employer/_requirementCalls";

function EvidenceBody({ evidence }: { evidence: EvidenceResponse }) {
  const locked = evidence.quotesLocked === true || evidence.unlocked === false;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {evidence.sessionDate && (
        <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
          From most recent practice session · {new Date(evidence.sessionDate).toLocaleDateString()}
        </div>
      )}
      {evidence.skills.length === 0 ? (
        <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: 0 }}>
          This candidate has no completed practice session yet, so there are no skill scores to show. Their match score reflects resume fit only.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {evidence.skills.map((s) => {
            const score = Math.max(0, Math.min(100, Math.round(s.score)));
            return (
              <li key={s.name}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: f.sans, fontSize: textSize.base, color: t.coal, marginBottom: 4 }}>
                  <span>{s.name}</span>
                  <strong>
                    {score}
                    <span className="sr-only"> out of 100</span>
                  </strong>
                </div>
                <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: t.line, overflow: "hidden" }}>
                  <div style={{ width: `${score}%`, height: "100%", background: score >= 70 ? t.success : score >= 50 ? t.warning : t.error }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {locked && (
        <InlineNotice tone="info" live={false}>
          Interview answer quotes are hidden until you unlock this candidate.
        </InlineNotice>
      )}
    </div>
  );
}

/** Per-skill evidence for one candidate. Skill scores are always visible;
    verbatim answer quotes only arrive after unlock (server-enforced). */
export default function EvidenceDialog({
  matchId,
  displayName,
  unlocked,
  onClose,
}: {
  matchId: string | null;
  displayName: string;
  unlocked: boolean;
  onClose: () => void;
}) {
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    setLoading(true);
    setEvidence(null);
    setError(null);
    getEvidence(matchId).then((res) => {
      if (!active) return;
      if (res.ok) setEvidence(res.data);
      else setError(failureMessage("evidence", res));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [matchId, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <Dialog open={matchId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent aria-describedby="evidence-dialog-desc">
        <DialogHeader>
          <DialogTitle>Evidence report: {displayName}</DialogTitle>
          <DialogDescription id="evidence-dialog-desc">
            Per-skill scores from this candidate&apos;s most recent completed practice session.
          </DialogDescription>
          {!unlocked && (
            <div>
              <IdentityHiddenBadge compact />
            </div>
          )}
        </DialogHeader>
        <div role="status" aria-live="polite" aria-busy={loading}>
          {loading && (
            <div style={{ display: "grid", gap: 12 }}>
              <span className="sr-only">Loading practice-session evidence</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} aria-hidden="true" style={{ height: 28, width: "100%" }} />
              ))}
            </div>
          )}
        </div>
        {!loading && error && (
          <InlineNotice
            tone="error"
            title="Couldn't load the evidence report"
            action={<OutlineCta size="sm" onClick={retry}>Try again</OutlineCta>}
          >
            {error}
          </InlineNotice>
        )}
        {!loading && evidence && <EvidenceBody evidence={evidence} />}
      </DialogContent>
    </Dialog>
  );
}
