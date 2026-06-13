import React from "react";

const sage = "#15803D";
const gilt = "#B45309";
const giltDark = "#923F07";
const stone = "#6E6759";
const cream = "#FAF7F0";
const border = "#EBE5D2";
const ember = "#B91C1C";
const fontUi = "'Inter', 'SF Pro Display', system-ui, sans-serif";

const FREE_SESSION_LIMIT = 3;
const STARTER_WEEKLY_LIMIT = 10;

interface Props {
  tier?: "pro" | "starter" | "free";
  sessionsUsed?: number;
  sessionsThisWeek?: number;
  subscriptionEnd?: string;
}

export function PlanStatusWidget({
  tier = "pro",
  sessionsUsed = 0,
  sessionsThisWeek = 7,
  subscriptionEnd = "2026-07-07",
}: Props) {
  const isPro = tier === "pro";
  const isStarter = tier === "starter";
  const isFree = tier === "free";

  const sessionsRemaining = Math.max(0, FREE_SESSION_LIMIT - sessionsUsed);
  const starterRemaining = Math.max(0, STARTER_WEEKLY_LIMIT - sessionsThisWeek);
  const isZeroSession = isFree && sessionsRemaining === 0;

  const cardBg = isPro
    ? "rgba(21,128,61,0.11)"
    : isZeroSession
    ? "rgba(180,83,9,0.14)"
    : "rgba(180,83,9,0.08)";

  const cardBorder = isPro
    ? "rgba(21,128,61,0.22)"
    : isZeroSession
    ? "rgba(185,28,28,0.28)"
    : "rgba(180,83,9,0.2)";

  const sessionColor =
    (isFree && sessionsRemaining <= 1 && sessionsRemaining > 0) ||
    (isStarter && starterRemaining <= 2 && starterRemaining > 0)
      ? ember
      : stone;

  const sessionWeight =
    (isFree && sessionsRemaining <= 1) || (isStarter && starterRemaining <= 2)
      ? 600
      : 400;

  const sessionText = isPro
    ? "Unlimited sessions"
    : isStarter
    ? `${starterRemaining} of ${STARTER_WEEKLY_LIMIT} sessions this week${starterRemaining <= 2 && starterRemaining > 0 ? ", running low" : ""}`
    : sessionsRemaining > 0
    ? `${sessionsRemaining} of ${FREE_SESSION_LIMIT} session${sessionsRemaining !== 1 ? "s" : ""} remaining${sessionsRemaining === 1 ? ", last one" : ""}`
    : "No sessions left. Upgrade to continue.";

  const planBenefits = isPro
    ? "Unlimited sessions · STAR coaching · skill decay tracking · PDF reports"
    : isStarter
    ? `${STARTER_WEEKLY_LIMIT} sessions/week · STAR coaching · PDF reports · ₹49/week`
    : "3 lifetime sessions · basic feedback · upgrade anytime";

  const sessionMb = isStarter && subscriptionEnd ? 3 : 8;

  return (
    <div style={{ background: cream, padding: 16, minHeight: "100vh" }}>
      <div style={{ padding: "14px", borderRadius: 12, background: cardBg, border: `1px solid ${cardBorder}` }}>

        {/* Header: icon + plan name + ⓘ help + renewal date (Pro inline) */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          {isPro ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          ) : isStarter ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={gilt} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={gilt} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}

          <span style={{ fontFamily: fontUi, fontSize: 13, fontWeight: 700, color: isPro ? sage : gilt, letterSpacing: "0.01em" }}>
            {isPro ? "Pro Plan" : isStarter ? "Starter Plan" : "Free Plan"}
          </span>

          {/* ⓘ What's included tooltip */}
          <span title={planBenefits} style={{ display: "inline-flex", alignItems: "center", cursor: "help", color: isPro ? sage : gilt, opacity: 0.45, flexShrink: 0 }}>
            <svg aria-label="What's included" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>

          {/* Pro: renewal date right-aligned instead of badge */}
          {isPro && subscriptionEnd && (
            <span style={{ marginLeft: "auto", fontFamily: fontUi, fontSize: 10, color: sage, opacity: 0.75, whiteSpace: "nowrap" }}>
              Renews {new Date(subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Session status */}
        <p style={{ fontFamily: fontUi, fontSize: 11, color: sessionColor, lineHeight: 1.4, marginBottom: sessionMb, fontWeight: sessionWeight }}>
          {sessionText}
        </p>

        {/* Renewal + reset hint — Starter only */}
        {subscriptionEnd && isStarter && (
          <p style={{ fontFamily: fontUi, fontSize: 10, color: stone, marginBottom: 10 }}>
            Renews {new Date(subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · sessions reset Sun
          </p>
        )}

        {/* Progress bar */}
        {(isFree || isStarter) && (
          <div style={{ height: 3, borderRadius: 2, background: border, marginBottom: 12 }}>
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: isFree
                  ? sessionsRemaining === 0 ? ember : gilt
                  : starterRemaining === 0 ? ember : gilt,
                width: `${Math.min(100, isFree
                  ? (sessionsUsed / FREE_SESSION_LIMIT) * 100
                  : (sessionsThisWeek / STARTER_WEEKLY_LIMIT) * 100)}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
        )}

        {/* CTA */}
        {isPro ? (
          <>
            <button
              title="Billing, invoices, and plan changes (⌘B)"
              style={{ width: "100%", padding: "8px 0", borderRadius: 8, cursor: "pointer", border: "none", background: sage, color: "#fff", fontFamily: fontUi, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em" }}
            >
              Manage Subscription
            </button>
            <button
              title="Cancel or downgrade your subscription"
              style={{ display: "block", width: "100%", marginTop: 6, background: "none", border: "none", cursor: "pointer", fontFamily: fontUi, fontSize: 10, color: stone, opacity: 0.6, textAlign: "center" as const, padding: "2px 0" }}
            >
              Cancel plan
            </button>
          </>
        ) : (
          <button
            title="See what's included in Pro — unlimited sessions, STAR coaching, skill tracking"
            style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${gilt}, ${giltDark})`, color: cream, fontFamily: fontUi, fontSize: 12, fontWeight: 600 }}
          >
            {isFree && sessionsRemaining === 0 ? "Unlock sessions now" : "Upgrade to Pro"}
          </button>
        )}
      </div>
    </div>
  );
}

export default PlanStatusWidget;
