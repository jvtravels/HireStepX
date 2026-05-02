/* HireStepX — Interview canvas / reconnecting overlay
   Full-screen recovery state when network drops mid-interview.
   Distinct from inline ConnectionNotice (slow but working) — this is
   the "we lost you, hold on" moment. Critical for trust: if we look
   chaotic when the network blips, users abandon. */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { INTERVIEW_STYLES } from "./_styles";

export interface ReconnectingProps {
  attempt?: number;
  /** Question number user was on — reassures progress is saved. */
  question?: { current: number; total: number };
}

export default function Reconnecting({
  attempt = 2,
  question = { current: 3, total: 5 },
}: ReconnectingProps) {
  return (
    <>
      <style>{INTERVIEW_STYLES}</style>
      <div
        style={{
          background: t.cream,
          width: "100%",
          minHeight: "100dvh",
          fontFamily: f.sans,
          color: t.coal,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div
          style={{
            maxWidth: 460,
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 20,
            padding: "32px 32px 28px",
            boxShadow: shadows.modal,
            textAlign: "center",
          }}
        >
          {/* Spinner */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              background: t.creamSoft,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.indigo}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hsx-spin"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            </svg>
          </div>

          <h2
            style={{
              margin: 0,
              fontFamily: f.serif,
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.2,
              color: t.coal,
              letterSpacing: -0.4,
            }}
          >
            Reconnecting <em style={{ color: t.copper, fontStyle: "italic" }}>you</em>…
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontFamily: f.sans,
              fontSize: 14,
              color: t.inkSoft,
              lineHeight: 1.55,
            }}
          >
            Your network blipped. We&rsquo;ve saved everything up to question{" "}
            <strong style={{ color: t.coal }}>
              {question.current} of {question.total}
            </strong>
            . You&rsquo;ll pick up exactly where you left off.
          </p>

          {/* Attempt indicator */}
          <div
            style={{
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 999,
              fontFamily: f.mono,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.4,
              color: t.inkSoft,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: t.warning }} />
            Attempt {attempt} of 5
          </div>

          {/* Secondary action */}
          <div
            style={{
              marginTop: 22,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              type="button"
              style={{
                background: "transparent",
                color: t.coal,
                border: `1px solid ${t.line}`,
                borderRadius: 999,
                padding: "10px 18px",
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Pause and resume later
            </button>
            <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>
              We&rsquo;ll email you a link to come back.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
