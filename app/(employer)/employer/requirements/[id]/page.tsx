"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEmployerData, Requirement } from "@/employer/EmployerDataContext";
import { useToast } from "@/Toast";
import { Candidate } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  Card,
  Divider,
  Eyebrow,
  EmployerIcon,
  HelpText,
  OutlineCta,
  PrimaryCta,
  ScoreChip,
  SkillTag,
  StatusChip,
} from "@/employer/_atoms";

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

function CandidateRow({
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
    <Card>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {!readOnly && (
          <input
            type="checkbox"
            checked={compareChecked}
            disabled={compareDisabled && !compareChecked}
            onChange={onToggleCompare}
            title="Select to compare"
            style={{ marginTop: 6, width: 16, height: 16 }}
          />
        )}
        <ScoreChip score={candidate.matchScore} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal }}>
                {candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`}
              </span>
              <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginLeft: 8 }}>
                {candidate.targetRole} · {candidate.city}
              </span>
            </div>
          </div>

          <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 6 }}>
            Match score {candidate.matchScore} for this role · Roster score {candidate.rosterScore} across{" "}
            {candidate.sessionsCompleted} practice sessions · active {candidate.lastActiveDaysAgo}d ago
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {candidate.skills.map((s) => (
              <SkillTag key={s}>{s}</SkillTag>
            ))}
          </div>

          <Divider />

          {candidate.unlocked ? (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>
                {candidate.contact?.email}
              </div>
              {!readOnly && (
                <Link href={`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`} style={{ textDecoration: "none" }}>
                  <OutlineCta size="sm">How did it go?</OutlineCta>
                </Link>
              )}
            </div>
          ) : readOnly ? (
            <div style={{ marginTop: 12 }}>
              <HelpText>This requirement is closed — contact unlocking is no longer available.</HelpText>
            </div>
          ) : confirming ? (
            <div style={{ marginTop: 12, background: t.creamSoft, borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, marginBottom: 10 }}>
                Unlock this candidate's contact details for <strong>{displayPrice}</strong>?
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <PrimaryCta size="sm" onClick={handleConfirmUnlock} disabled={unlocking}>
                  {unlocking ? "Unlocking…" : "Confirm & unlock"}
                </PrimaryCta>
                <OutlineCta size="sm" onClick={() => setConfirming(false)}>Cancel</OutlineCta>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <PrimaryCta size="sm" icon={<EmployerIcon.Lock />} onClick={() => setConfirming(true)}>
                Unlock contact — {displayPrice}
              </PrimaryCta>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { fetchRequirementDetail } = useEmployerData();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);

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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Eyebrow tone="indigo">{requirement.location} · {requirement.noticePeriodPref} notice</Eyebrow>
          <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "6px 0 0" }}>{requirement.title}</h1>
        </div>
        <StatusChip status={requirement.status} />
      </div>

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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sorted.map((c) => (
              <CandidateRow
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
          </div>
        </>
      )}
    </div>
  );
}
