"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEmployerData, Requirement } from "@/employer/EmployerDataContext";
import { useToast } from "@/Toast";
import { Candidate } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  Card,
  Eyebrow,
  EmployerIcon,
  HelpText,
  OutlineCta,
  Pill,
  PrimaryCta,
  ScoreChip,
  SkillTag,
  StatCell,
  StatusChip,
} from "@/employer/_atoms";

function experienceLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} yrs experience`;
  if (min != null) return `${min}+ yrs experience`;
  return `Up to ${max} yrs experience`;
}

function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

const th: CSSProperties = {
  textAlign: "left",
  fontFamily: f.sans,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: t.inkFaint,
  padding: "0 14px 12px",
};

const td: CSSProperties = {
  padding: "14px",
  borderTop: `1px solid ${t.line}`,
  fontFamily: f.sans,
  fontSize: 13.5,
  color: t.coal,
  verticalAlign: "top",
};

function GeneratingState() {
  return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <div style={{ width: 40, height: 40, margin: "0 auto 20px", border: `3px solid ${t.indigo100}`, borderTopColor: t.indigo, borderRadius: "50%", animation: "hsx-emp-spin 0.8s linear infinite" }} />
      <style>{`@keyframes hsx-emp-spin { to { transform: rotate(360deg); } }`}</style>
      <h2 style={{ fontFamily: f.serif, fontSize: 22, color: t.coal, margin: "0 0 8px" }}>Matching candidates…</h2>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft }}>
        We're scoring active candidates against this requirement. This usually takes under a minute.
      </p>
    </div>
  );
}

function ZeroMatchState() {
  return (
    <Card style={{ textAlign: "center", padding: 48 }}>
      <h2 style={{ fontFamily: f.serif, fontSize: 22, color: t.coal, margin: "0 0 8px" }}>No matches yet</h2>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginBottom: 20 }}>
        No candidates currently practicing on HireStepX match this requirement closely enough to shortlist.
        Try widening the location or notice period, or check back as more candidates practice this week.
      </p>
      <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
        <OutlineCta>Post a broader requirement</OutlineCta>
      </Link>
    </Card>
  );
}

function FailedState() {
  return (
    <Card style={{ textAlign: "center", padding: 48 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: t.error100, color: t.error, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <EmployerIcon.Alert />
      </div>
      <h2 style={{ fontFamily: f.serif, fontSize: 22, color: t.coal, margin: "0 0 8px" }}>Matching failed</h2>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginBottom: 20 }}>
        Something went wrong generating this shortlist. No charge was made — you can safely try again.
      </p>
      <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
        <PrimaryCta icon={<EmployerIcon.Refresh />}>Try again</PrimaryCta>
      </Link>
    </Card>
  );
}

// Dynamically loads the Razorpay checkout script with a CSP nonce — see
// handleCheckout in src/dashboardComponents.tsx for the original pattern
// this mirrors (strict-dynamic CSP means a script tag without the nonce
// is silently blocked, not rejected).
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content");
    if (nonce) s.nonce = nonce;
    const timer = setTimeout(() => { s.remove(); reject(new Error("timeout")); }, 10_000);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error("load failed")); };
    document.head.appendChild(s);
  });
}

function CandidateTableRow({
  candidate,
  requirementId,
  readOnly,
  compareChecked,
  onToggleCompare,
  compareDisabled,
  onUnlocked,
}: {
  candidate: Candidate;
  requirementId: string;
  readOnly: boolean;
  compareChecked: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
  onUnlocked: (candidateId: string, name: string, email: string) => void;
}) {
  const { createUnlockOrder, verifyUnlockPayment } = useEmployerData();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Display-only — mirrors the >= 60 threshold in
  // server-handlers/_unlock-pricing.ts, which is the sole source of truth
  // for the amount actually charged.
  const displayPrice = candidate.matchScore >= 60 ? "₹1,999" : "₹999";

  const handleConfirmUnlock = async () => {
    setUnlocking(true);
    const order = await createUnlockOrder(candidate.id);
    if (!order) {
      setUnlocking(false);
      toast("Couldn't start payment — please try again", "error");
      return;
    }

    try {
      await loadRazorpayScript();
    } catch {
      setUnlocking(false);
      toast("Payment system failed to load. Check your connection and try again.", "error");
      return;
    }
    if (!window.Razorpay) {
      setUnlocking(false);
      toast("Payment system not available. Please refresh and try again.", "error");
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.orderId,
      theme: { color: t.indigo },
      method: { upi: true, card: true, netbanking: true, wallet: true },
      handler: async function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
        const result = await verifyUnlockPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        setUnlocking(false);
        setConfirming(false);
        if (!result) {
          toast("Payment received but unlock failed — contact support@hirestepx.com", "error");
          return;
        }
        onUnlocked(candidate.id, result.name, result.contact.email);
        toast(`Unlocked ${result.name}'s contact details`, "success");
      },
      modal: {
        ondismiss: function () { setUnlocking(false); },
      },
    });
    (rzp as unknown as { on(event: string, cb: (r: unknown) => void): void }).on("payment.failed", function (response: unknown) {
      const errDetail = (response as { error?: { description?: string; reason?: string } })?.error;
      toast(errDetail?.description || errDetail?.reason || "Payment failed. Please try again.", "error");
      setUnlocking(false);
    });
    rzp.open();
  };

  return (
    <tr>
      {!readOnly && (
        <td style={{ ...td, width: 32 }}>
          <input
            type="checkbox"
            checked={compareChecked}
            disabled={compareDisabled && !compareChecked}
            onChange={onToggleCompare}
            title="Select to compare"
            style={{ width: 16, height: 16 }}
          />
        </td>
      )}
      <td style={td}>
        <Link
          href={`/employer/requirements/${requirementId}/candidates/${candidate.id}`}
          style={{ fontWeight: 700, fontSize: 14, color: t.coal, textDecoration: "none" }}
          onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
          onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}
        >
          {candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`}
        </Link>
        <div style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 2 }}>
          {candidate.targetRole} · {candidate.city}
        </div>
      </td>
      <td style={td}>
        <ScoreChip score={candidate.matchScore} />
      </td>
      <td style={{ ...td, color: t.inkSoft }}>
        {candidate.rosterScore} roster · {candidate.sessionsCompleted} sessions
      </td>
      <td style={{ ...td, color: t.inkSoft }}>
        {candidate.lastActiveDaysAgo < 0 ? "—" : `${candidate.lastActiveDaysAgo}d ago`}
      </td>
      <td style={{ ...td, maxWidth: 220 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {candidate.skills.slice(0, 3).map((s) => (
            <SkillTag key={s}>{s}</SkillTag>
          ))}
          {candidate.skills.length > 3 && (
            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, alignSelf: "center" }}>
              +{candidate.skills.length - 3}
            </span>
          )}
        </div>
      </td>
      <td style={td}>
        <Pill tone={candidate.unlocked ? "success" : "neutral"}>{candidate.unlocked ? "Unlocked" : "Locked"}</Pill>
      </td>
      <td style={{ ...td, minWidth: 200 }}>
        {candidate.unlocked ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal }}>{candidate.contact?.email}</span>
            {!readOnly && (
              <Link href={`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`} style={{ textDecoration: "none" }}>
                <OutlineCta size="sm">How did it go?</OutlineCta>
              </Link>
            )}
          </div>
        ) : readOnly ? (
          <HelpText>Unlocking closed</HelpText>
        ) : confirming ? (
          <div style={{ background: t.creamSoft, borderRadius: 10, padding: 10 }}>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal, marginBottom: 8 }}>
              Unlock for <strong>{displayPrice}</strong>?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <PrimaryCta size="sm" onClick={handleConfirmUnlock} disabled={unlocking}>
                {unlocking ? "Unlocking…" : "Confirm"}
              </PrimaryCta>
              <OutlineCta size="sm" onClick={() => setConfirming(false)}>Cancel</OutlineCta>
            </div>
          </div>
        ) : (
          <PrimaryCta size="sm" icon={<EmployerIcon.Lock />} onClick={() => setConfirming(true)}>
            Unlock — {displayPrice}
          </PrimaryCta>
        )}
      </td>
    </tr>
  );
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { fetchRequirementDetail } = useEmployerData();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [descExpanded, setDescExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchRequirementDetail(params.id);
    setRequirement(r);
    setLoading(false);
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // A freshly created requirement matches synchronously on the server, so
  // by the time this page loads it's already past "generating" in
  // practice — this poll only covers the rare case of a stale fetch.
  useEffect(() => {
    if (requirement?.status !== "generating") return;
    const timer = setTimeout(load, 2500);
    return () => clearTimeout(timer);
  }, [requirement?.status, load]);

  const handleUnlocked = (candidateId: string, name: string, email: string) => {
    setRequirement((prev) =>
      prev
        ? {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id !== candidateId ? c : { ...c, unlocked: true, name, contact: { email } }
            ),
          }
        : prev
    );
  };

  if (loading) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
      </Card>
    );
  }

  if (!requirement) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Requirement not found.</p>
      </Card>
    );
  }

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 2 ? [...prev, id] : prev));
  };

  const readOnly = requirement.status === "closed";
  const sorted = [...requirement.candidates].sort((a, b) => b.matchScore - a.matchScore);
  const unlockedCount = requirement.candidates.filter((c) => c.unlocked).length;
  const avgMatch = requirement.candidates.length
    ? Math.round(requirement.candidates.reduce((sum, c) => sum + c.matchScore, 0) / requirement.candidates.length)
    : 0;
  const expLabel = experienceLabel(requirement.experienceMin, requirement.experienceMax);
  const dueDaysLeft = requirement.dueDate ? daysUntil(requirement.dueDate) : null;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Eyebrow tone="indigo">{requirement.location} · {requirement.noticePeriodPref} notice</Eyebrow>
            <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "6px 0 0" }}>{requirement.title}</h1>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {expLabel && <span>{expLabel}</span>}
              {dueDaysLeft != null && (
                <span>
                  {dueDaysLeft < 0 ? `${Math.abs(dueDaysLeft)}d overdue` : dueDaysLeft === 0 ? "Due today" : `${dueDaysLeft}d until due`}
                </span>
              )}
              <span>Posted {requirement.createdAt}</span>
            </div>
          </div>
          <StatusChip status={requirement.status} />
        </div>

        {requirement.description && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: 13.5,
                color: t.inkSoft,
                lineHeight: 1.6,
                margin: 0,
                display: descExpanded ? "block" : "-webkit-box",
                WebkitLineClamp: descExpanded ? undefined : 2,
                WebkitBoxOrient: "vertical",
                overflow: descExpanded ? "visible" : "hidden",
              }}
            >
              {requirement.description}
            </p>
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              style={{ background: "none", border: "none", padding: 0, marginTop: 6, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.indigo, cursor: "pointer" }}
            >
              {descExpanded ? "Show less" : "Read more"}
            </button>
          </div>
        )}
      </Card>

      {requirement.candidates.length > 0 && requirement.status !== "generating" && (
        <Card style={{ marginBottom: 16, padding: "4px 20px" }}>
          <div style={{ display: "flex" }}>
            <StatCell label="Candidates shared" value={String(requirement.candidates.length)} unit="" />
            <StatCell label="Contacts unlocked" value={String(unlockedCount)} unit="" />
            <StatCell label="Avg match score" value={String(avgMatch)} unit="/ 100" />
          </div>
        </Card>
      )}

      {requirement.status === "generating" && <GeneratingState />}
      {requirement.status === "failed" && <FailedState />}
      {requirement.status === "zero" && <ZeroMatchState />}

      {(requirement.status === "ready" || requirement.status === "partial" || requirement.status === "closed") && (
        <>
          {requirement.status === "partial" && (
            <Card style={{ background: t.warning100, border: "none", marginBottom: 16 }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.warningInk }}>
                Only a partial match was found — fewer candidates met this requirement closely. Consider widening
                location or experience range.
              </span>
            </Card>
          )}
          {readOnly && (
            <Card style={{ background: t.creamSoft, marginBottom: 16 }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                This requirement is closed. Candidate details are read-only.
              </span>
            </Card>
          )}
          {!readOnly && compareIds.length === 2 && (
            <div style={{ marginBottom: 16 }}>
              <Link
                href={`/employer/requirements/${requirement.id}/compare?a=${compareIds[0]}&b=${compareIds[1]}`}
                style={{ textDecoration: "none" }}
              >
                <PrimaryCta size="sm">Compare selected candidates</PrimaryCta>
              </Link>
            </div>
          )}
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>
                    {!readOnly && <th style={{ ...th, paddingTop: 20 }}></th>}
                    <th style={{ ...th, paddingTop: 20 }}>Candidate</th>
                    <th style={{ ...th, paddingTop: 20 }}>Match</th>
                    <th style={{ ...th, paddingTop: 20 }}>Practice history</th>
                    <th style={{ ...th, paddingTop: 20 }}>Last active</th>
                    <th style={{ ...th, paddingTop: 20 }}>Skills</th>
                    <th style={{ ...th, paddingTop: 20 }}>Status</th>
                    <th style={{ ...th, paddingTop: 20 }}>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <CandidateTableRow
                      key={c.id}
                      candidate={c}
                      requirementId={requirement.id}
                      readOnly={readOnly}
                      compareChecked={compareIds.includes(c.id)}
                      compareDisabled={compareIds.length >= 2}
                      onToggleCompare={() => toggleCompare(c.id)}
                      onUnlocked={handleUnlocked}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
