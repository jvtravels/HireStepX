"use client";

/* Settings → "Employer visibility". The candidate's consent control for
   employer discovery (DPDP Act 2023: free, specific, informed, revocable).
   States the purpose, what employers can and can't see, retention and how to
   withdraw, right next to the switch that gives or withdraws consent. */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { tokens as t, fonts as f } from "./auth/_tokens";
import {
  describeHistoryEntry, fetchVisibility, saveVisibility, viewedLabel,
  type VisibilityState,
} from "./employerVisibility";

const HISTORY_PREVIEW = 3;

const bodyText = { fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: 0 } as const;
const listStyle = { ...bodyText, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 } as const;

export default function EmployerVisibilityCard({ showToast }: { showToast: (msg: string) => void }) {
  const switchId = useId();
  const descId = useId();
  const [state, setState] = useState<VisibilityState | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const stateRef = useRef<VisibilityState | null>(null);
  stateRef.current = state;

  const load = useCallback(async () => {
    setLoadState("loading");
    const s = await fetchVisibility();
    if (s) { setState(s); setLoadState("ready"); } else setLoadState("error");
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = useCallback(async (next: "masked" | "off") => {
    const previous = stateRef.current;
    if (!previous) return;
    // Optimistic: flip immediately, roll back to the exact prior state on failure.
    setState({ ...previous, visibility: next });
    setSaving(true);
    const result = await saveVisibility(next);
    setSaving(false);
    if (result.ok) {
      setState(result.state);
      showToast(next === "masked"
        ? "Employers can now discover your practice evidence. Your name and contact stay hidden."
        : "You're hidden from employers.");
    } else {
      setState(previous);
      showToast(`Couldn't update employer visibility — ${result.error}`);
    }
  }, [showToast]);

  const visible = state?.visibility === "masked";

  const onToggle = (checked: boolean) => {
    if (!state || saving) return;
    if (checked) apply("masked");
    else setConfirmOff(true);
  };

  const history = state?.history ?? [];
  const shownHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <label htmlFor={switchId} style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, cursor: "pointer" }}>
            Let employers discover my practice evidence
          </label>
          <p id={descId} style={{ ...bodyText, marginTop: 4 }}>
            Hiring teams on HireStepX can find you by role and skills, using what you&apos;ve shown in your practice
            interviews. Your name and contact details stay hidden until an employer pays to unlock them.
          </p>
        </div>
        {loadState === "ready" ? (
          <Switch
            id={switchId}
            checked={visible}
            onCheckedChange={onToggle}
            disabled={saving}
            aria-describedby={descId}
            style={{ marginTop: 2 }}
          />
        ) : (
          <Skeleton style={{ width: 32, height: 18, borderRadius: 999, marginTop: 2 }} />
        )}
      </div>

      {loadState === "error" && (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <p style={{ ...bodyText, color: t.error }}>Couldn&apos;t load your visibility setting.</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Polite live region so screen-reader users hear the saved state, not just a toast. */}
      <p aria-live="polite" style={{ ...bodyText, fontWeight: 600, color: t.coal }}>
        {loadState === "ready" && (saving ? "Saving…" : visible ? "Status: visible to employers (name and contact hidden)" : "Status: hidden from employers")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div>
          <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>What employers can see</h3>
          <ul style={listStyle}>
            <li>Skill strengths and verified capabilities from your practice sessions</li>
            <li>Readiness and answer-structure (STAR) indicators</li>
            <li>A summary of your resume with your name, past employers and schools removed, and your city</li>
            <li>When you last practised</li>
          </ul>
        </div>
        <div>
          <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>What stays hidden until they unlock</h3>
          <ul style={listStyle}>
            <li>Your name, email, phone number and LinkedIn</li>
            <li>The names of your past employers and schools</li>
            <li>Word-for-word excerpts of your answers</li>
            <li>Before unlock, employers see only &ldquo;Candidate #&hellip;&rdquo;</li>
          </ul>
        </div>
      </div>

      <p style={bodyText}>
        Turn this off any time. You&apos;ll be removed from employer searches and new matches straight away. An employer who
        has already unlocked your details keeps what they paid for, but can&apos;t see anything new. You can also{" "}
        <strong style={{ fontWeight: 600 }}>block or report</strong> a specific employer from Jobs or Messages. Questions or complaints:{" "}
        <a href="/grievance" className="underline underline-offset-4" style={{ color: t.indigo }}>Grievance Officer</a>.
        See the <a href="/privacy" className="underline underline-offset-4" style={{ color: t.indigo }}>Privacy Policy</a>.
      </p>

      {loadState === "ready" && (
        <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ ...bodyText, color: t.coal }}>{viewedLabel(state?.stats.employersViewedLast30d ?? 0)}</p>
          {history.length > 0 && (
            <div>
              <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>Your consent history</h3>
              <ul style={{ ...listStyle, listStyle: "none", paddingLeft: 0 }}>
                {shownHistory.map((h, i) => (
                  <li key={`${h.createdAt}-${i}`}>{describeHistoryEntry(h)}</li>
                ))}
            </ul>
              {history.length > HISTORY_PREVIEW && (
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-expanded={showAllHistory}
                  onClick={() => setShowAllHistory((v) => !v)}
                  style={{ marginTop: 4, paddingLeft: 0, color: t.indigo }}
                >
                  {showAllHistory ? "Show less" : `Show all ${history.length}`}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={confirmOff} onOpenChange={(o) => { if (!saving) setConfirmOff(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide yourself from employers?</DialogTitle>
            <DialogDescription>
              You&apos;ll be removed from employer searches and from matches no one has unlocked yet. Employers who have
              already unlocked your details keep what they bought. You can turn this back on any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOff(false)}>Keep visible</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { setConfirmOff(false); apply("off"); }}
            >
              Hide me from employers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
