import React from "react";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { EmployerIcon, Pill } from "./_atoms";

/* Additive employer atoms. Lives beside _atoms.tsx (which is near its size
   budget); import from here, not from _atoms. */

export type VerificationTierValue = "basic" | "email_verified" | "verified";

const TIER_COPY: Record<VerificationTierValue, { label: string; tone: "neutral" | "indigo" | "success"; hint: string }> = {
  basic: { label: "Basic", tone: "neutral", hint: "Company profile saved. Verify your email to raise your daily limits." },
  email_verified: { label: "Email verified", tone: "indigo", hint: "Work email confirmed. Higher daily limits than Basic." },
  verified: { label: "Verified employer", tone: "success", hint: "Company verified by HireStepX. Highest limits." },
};

/** Employer verification tier. The tier is always spelled out in text and
 *  paired with an icon, so it never relies on colour alone. */
export function VerificationBadge({ tier, showHint = false }: { tier: VerificationTierValue; showHint?: boolean }) {
  const copy = TIER_COPY[tier];
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4, maxWidth: "100%" }}>
      <span title={copy.hint}>
        <Pill tone={copy.tone}>
          {tier !== "basic" && <EmployerIcon.Check />}
          <span>
            <span className="sr-only">Verification level: </span>
            {copy.label}
          </span>
        </Pill>
      </span>
      {showHint && <span style={{ fontFamily: f.sans, fontSize: 12, color: t.neutralInk }}>{copy.hint}</span>}
    </span>
  );
}

const MASKED_NAME = /^Candidate #[a-z0-9]+$/i;

/** True when the server (or the page, pre-unlock) is showing the anonymous
 *  `Candidate #abc123` placeholder rather than a real name. */
export function isMaskedName(name: string): boolean {
  return MASKED_NAME.test(name.trim());
}

/** A candidate's name with the "identity hidden" treatment when it is the
 *  anonymous placeholder. `masked` overrides detection (e.g. a locked match
 *  whose name field is not in placeholder form). */
export function MaskedIdentity({
  name,
  masked,
  as: Heading = "span",
  nameStyle,
  hideBadge = false,
}: {
  name: string;
  masked?: boolean;
  as?: "span" | "h1" | "h2" | "h3";
  nameStyle?: React.CSSProperties;
  hideBadge?: boolean;
}) {
  const isMasked = masked ?? isMaskedName(name);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
      <Heading style={{ margin: 0, fontFamily: f.sans, fontWeight: 600, color: t.coal, overflowWrap: "anywhere", ...nameStyle }}>{name}</Heading>
      {isMasked && !hideBadge && (
        <Pill tone="neutral">
          <EmployerIcon.Lock />
          Identity hidden until unlock
        </Pill>
      )}
    </span>
  );
}
