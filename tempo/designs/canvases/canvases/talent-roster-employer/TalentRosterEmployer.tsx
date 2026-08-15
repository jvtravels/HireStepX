import React from "react";
import { tokens as t, fonts as f, shadows } from "../../design-system/_tokens";
import {
  Wordmark,
  Eyebrow,
  Pill,
  ScoreChip,
  Card,
  PrimaryCta,
  OutlineCta,
  SkillTag,
  StatusChip,
  FieldLabel,
  HelpText,
  Divider,
  Checkbox,
  Icon,
} from "./_atoms";

export type Variant =
  | "employers-landing"
  | "company-login"
  | "console-empty"
  | "console"
  | "post-requirement"
  | "generating"
  | "shortlist"
  | "comparison"
  | "partial-match"
  | "zero-match"
  | "generation-failed"
  | "unlock-confirm"
  | "unlock-failed"
  | "unlocked-contact"
  | "outcome-feedback"
  | "requirement-closed"
  | "company-onboarding"
  | "company-pending"
  | "company-rejected";

/* ── Shared constants ───────────────────────────────────────────── */

const UNLOCK_FEE_RANGE = "₹999–1,999";
const CTC_BAND_ASOF = "Jul 2026";
const FAIRNESS_LINE = "Scoring never sees name, gender, or college — only skills and session performance.";
const CONSENT_LINE = "Every candidate has explicitly opted in to being shown to employers — nothing here is sold or shared without consent.";

/* ── Fixtures ───────────────────────────────────────────────────── */
/* Each candidate carries TWO distinct numbers on purpose:
   - matchScore: computed fresh against THIS requirement's must-haves
   - rosterScore: the candidate's standing lifetime average, shown with
     sample size + recency so employers can judge how much to trust it.
   The unlock flow (confirm → failed → contact → feedback) follows ONE
   candidate throughout — Rohit Sharma / #22 — so identity never drifts
   between screens. */

const requirements = [
  { id: "1", title: "Senior Backend Engineer — Payments", status: "ready" as const, matched: 10, postedAgo: "2 days ago" },
  { id: "2", title: "Product Designer, Growth", status: "generating" as const, matched: 0, postedAgo: "3 hours ago" },
  { id: "3", title: "SDET — Mobile QA", status: "failed" as const, matched: 0, postedAgo: "1 day ago" },
  { id: "4", title: "Customer Success Lead", status: "closed" as const, matched: 10, postedAgo: "3 weeks ago" },
];

const candidates = [
  {
    id: "c1",
    name: "Ananya Kulkarni",
    label: "Candidate #14",
    matchScore: 91,
    rosterScore: 88,
    sessions: 9,
    rosterUpdatedAgo: "5 days ago",
    noticePeriod: "30 days notice",
    visibility: "Also shortlisted for 1 other open role",
    skills: ["System design", "Postgres", "Payments idempotency", "Incident response"],
    reasoning:
      "Consistently strong across 9 scored mock interviews, with the strongest System Design and Data Modelling STAR answers in this pool. Handled a simulated on-call incident question with a clear rollback + comms plan — closest match to the payments-reliability bar you set.",
    ctc: { min: 28, max: 34 },
    unlocked: true,
  },
  {
    id: "c2",
    name: "Rohit Sharma",
    label: "Candidate #22",
    matchScore: 84,
    rosterScore: 81,
    sessions: 5,
    rosterUpdatedAgo: "3 weeks ago",
    noticePeriod: "Immediate joiner",
    visibility: "Not currently shown to any other employer",
    skills: ["Distributed systems", "Kafka", "Postgres", "Leadership"],
    reasoning:
      "Match score of 84 against this requirement, driven by sharp trade-off reasoning in distributed-systems questions and a STAR answer on a production incident that mirrors your on-call rotation. Slightly lighter on payments-specific vocabulary than #14.",
    ctc: { min: 24, max: 29 },
    unlocked: false,
  },
  {
    id: "c3",
    name: "Priya Nair",
    label: "Candidate #31",
    matchScore: 79,
    rosterScore: 76,
    sessions: 4,
    rosterUpdatedAgo: "2 months ago",
    noticePeriod: "15 days notice",
    visibility: "Also shortlisted for 2 other open roles",
    skills: ["Node.js", "Postgres", "API design", "Testing"],
    reasoning:
      "Solid, dependable answers across 4 sessions with no weak spots, but no standout System Design score to separate from the pool. Good fit if you're optimizing for reliability over ceiling.",
    ctc: { min: 20, max: 25 },
    unlocked: false,
  },
];

const unlockCandidate = candidates[1]; // Rohit Sharma / #22 — the one this canvas's unlock flow follows end to end.

/* ── Shell ──────────────────────────────────────────────────────── */

function TeamAvatars() {
  const initials = ["RK", "SM"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex" }}>
        {initials.map((label, i) => (
          <div
            key={label}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: t.indigo100,
              color: t.indigoDeep,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: f.sans,
              fontWeight: 700,
              fontSize: 13,
              border: `2px solid ${t.cream}`,
              marginLeft: i === 0 ? 0 : -10,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <OutlineCta size="sm" icon={<Icon.Plus />}>
        Invite teammate
      </OutlineCta>
    </div>
  );
}

function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  const nav = [
    { key: "requirements", label: "Requirements" },
    { key: "billing", label: "Billing" },
    { key: "settings", label: "Settings" },
  ];
  return (
    <div style={{ display: "flex", minHeight: "100%", background: t.cream }}>
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          borderRight: `1px solid ${t.line}`,
          padding: "24px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <Wordmark />
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {nav.map((n) => (
            <div
              key={n.key}
              style={{
                padding: "9px 12px",
                borderRadius: 8,
                fontFamily: f.sans,
                fontSize: 13.5,
                fontWeight: n.key === active ? 700 : 500,
                color: n.key === active ? t.indigoDeep : t.inkSoft,
                background: n.key === active ? t.indigo100 : "transparent",
              }}
            >
              {n.label}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <Card pad={14} background={t.copperSoft} border={`1px solid ${t.copperLine}`}>
            <Eyebrow tone="copper">Pilot cohort</Eyebrow>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
              You're on Phase 1 pricing. Unlocking a contact costs {UNLOCK_FEE_RANGE}, depending on seniority band.
            </div>
          </Card>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <Eyebrow>Acme Fintech Pvt Ltd</Eyebrow>
          </div>
          <TeamAvatars />
        </div>
        {children}
      </main>
    </div>
  );
}

function PageHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
      <div>
        <Eyebrow tone="indigo">{eyebrow}</Eyebrow>
        <h1 style={{ fontFamily: f.serif, fontSize: 38, fontWeight: 400, margin: "6px 0 0", color: t.coal }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}

/* ── 1. Console — requirements list ────────────────────────────── */

function Console() {
  return (
    <Shell active="requirements">
      <PageHeading
        eyebrow="Talent Roster"
        title="Hiring requirements"
        action={<PrimaryCta>+ Post a requirement</PrimaryCta>}
      />
      <Card pad={0}>
        {requirements.map((r, i) => (
          <div key={r.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px" }}>
              <div>
                <div style={{ fontFamily: f.sans, fontSize: 14.5, fontWeight: 600, color: t.coal }}>{r.title}</div>
                <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginTop: 4 }}>
                  Posted {r.postedAgo}
                  {r.status === "ready" && ` · ${r.matched} candidates matched`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <StatusChip status={r.status} />
                {r.status === "ready" && <OutlineCta size="sm">View shortlist</OutlineCta>}
                {r.status === "failed" && <PrimaryCta size="sm">Retry</PrimaryCta>}
                {r.status === "closed" && <OutlineCta size="sm">Duplicate</OutlineCta>}
              </div>
            </div>
            {i < requirements.length - 1 && <Divider />}
          </div>
        ))}
      </Card>
      <div style={{ marginTop: 14, fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, textAlign: "center" }}>
        Browsing shortlists is always free · unlocking a contact costs {UNLOCK_FEE_RANGE}, depending on seniority band
      </div>
    </Shell>
  );
}

/* ── 1b. Console — empty state (first-time employer) ──────────── */

function ConsoleEmpty() {
  return (
    <Shell active="requirements">
      <PageHeading eyebrow="Talent Roster" title="Hiring requirements" />
      <Card style={{ textAlign: "center", padding: "72px 40px" }}>
        <IconBadge icon={<Icon.Plus />} bg={t.indigo100} fg={t.indigoDeep} size={44} margin="0 auto 18px" />
        <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal }}>No hiring requirements yet</div>
        <div
          style={{
            fontFamily: f.sans,
            fontSize: 13.5,
            color: t.inkSoft,
            marginTop: 10,
            maxWidth: 420,
            margin: "10px auto 0",
            lineHeight: 1.6,
          }}
        >
          Post a role and we'll score every eligible candidate in the roster against it — ranked, with reasoning, in
          under a minute. Browsing is free; you only pay {UNLOCK_FEE_RANGE} when you unlock a contact.
        </div>
        <div style={{ marginTop: 24 }}>
          <PrimaryCta>+ Post your first requirement</PrimaryCta>
        </div>
      </Card>
    </Shell>
  );
}

/* ── 2. Post a requirement — form ──────────────────────────────── */

function PostRequirement() {
  return (
    <Shell active="requirements">
      <PageHeading eyebrow="Talent Roster" title="Post a hiring requirement" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <FieldLabel required>Role title</FieldLabel>
              <input
                readOnly
                value="Senior Backend Engineer — Payments"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: `1px solid ${t.lineStrong}`,
                  fontFamily: f.sans,
                  fontSize: 13.5,
                  color: t.coal,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <FieldLabel required>Must-have skills</FieldLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Node.js / TypeScript", "Postgres", "Payments systems", "System design"].map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
              <HelpText>Add up to 6 — the AI weighs these highest when scoring the roster.</HelpText>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <FieldLabel required>Experience range</FieldLabel>
                <input
                  readOnly
                  value="4–7 years"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: `1px solid ${t.lineStrong}`,
                    fontFamily: f.sans,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <FieldLabel required>Work mode</FieldLabel>
                <input
                  readOnly
                  value=""
                  placeholder="Select work mode"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: `1px solid ${t.error}`,
                    fontFamily: f.sans,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
                <HelpText tone="error">Select a work mode to continue.</HelpText>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <FieldLabel required>Location</FieldLabel>
                <input
                  readOnly
                  value="Bengaluru (Tier 1)"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: `1px solid ${t.lineStrong}`,
                    fontFamily: f.sans,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
                <HelpText>We band Advisory CTC by city tier — national averages are close to meaningless in India.</HelpText>
              </div>
              <div>
                <FieldLabel>Notice period preference</FieldLabel>
                <input
                  readOnly
                  value="Any"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: `1px solid ${t.lineStrong}`,
                    fontFamily: f.sans,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
                <HelpText>Optional — narrows the shortlist to immediate joiners or a notice-period ceiling.</HelpText>
              </div>
            </div>
            <div>
              <FieldLabel>Anything else the AI should weigh?</FieldLabel>
              <textarea
                readOnly
                rows={3}
                placeholder="e.g. prior fintech / RBI-regulated experience is a strong plus"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: `1px solid ${t.lineStrong}`,
                  fontFamily: f.sans,
                  fontSize: 13.5,
                  boxSizing: "border-box",
                  resize: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <OutlineCta>Save draft</OutlineCta>
              <PrimaryCta disabled>Generate shortlist</PrimaryCta>
            </div>
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card background={t.creamSoft} border={`1px solid ${t.line}`}>
            <Eyebrow tone="copper">How this works</Eyebrow>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
              We score every eligible candidate (≥3 sessions) against your must-haves and pull the top 10 by match.
              Each candidate's Roster Score counts their best 3 attempts per question set, weighted toward their most
              recent session — repeated retries beyond that don't move the number. You'll see the reasoning behind
              every match before you unlock contact details.
            </div>
          </Card>
          <Card background={t.indigo100} border={`1px solid ${t.indigoRing}`}>
            <Eyebrow tone="indigo">Pricing</Eyebrow>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.indigoDeep, marginTop: 10, lineHeight: 1.6 }}>
              Generating and browsing a shortlist is free. You only pay when you unlock a candidate's contact —{" "}
              {UNLOCK_FEE_RANGE}, depending on seniority band.
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

/* ── 3. Generating (loading) ───────────────────────────────────── */

function Generating() {
  return (
    <Shell active="requirements">
      <PageHeading eyebrow="Senior Backend Engineer — Payments" title="Building your shortlist" />
      <Card style={{ textAlign: "center", padding: "64px 40px" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: `3px solid ${t.line}`,
            borderTopColor: t.indigo,
            margin: "0 auto 20px",
          }}
        />
        <div style={{ fontFamily: f.serif, fontSize: 22, color: t.coal }}>Scoring the roster against your requirement…</div>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, marginTop: 8 }}>
          Usually takes under a minute. We'll email you the moment it's ready.
        </div>
      </Card>
    </Shell>
  );
}

/* ── 4. Shortlist results ──────────────────────────────────────── */

function CtcLine({ ctc }: { ctc: { min: number; max: number } }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <Eyebrow tone="copper">Advisory CTC</Eyebrow>
      <div style={{ fontFamily: f.mono, fontSize: 12.5, color: t.copper, fontWeight: 600 }}>
        ₹{ctc.min}–{ctc.max} LPA
      </div>
      <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>
        · modeled from HireStepX market bands (role × city tier × experience), not self-reported · as of {CTC_BAND_ASOF}
      </span>
    </div>
  );
}

function CandidateRow({
  c,
  readOnly = false,
  comparable = false,
}: {
  c: (typeof candidates)[number];
  readOnly?: boolean;
  comparable?: boolean;
}) {
  return (
    <div style={{ padding: "20px 22px", display: "flex", gap: 20 }}>
      {comparable && <Checkbox checked={false} label="" />}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <ScoreChip score={c.matchScore} />
        <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4, textTransform: "uppercase" }}>
          match
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontFamily: f.sans, fontSize: 14.5, fontWeight: 700, color: t.coal }}>{c.label}</div>
          <Pill tone="neutral">
            Roster Score {c.rosterScore} · {c.sessions} sessions · updated {c.rosterUpdatedAgo}
          </Pill>
          <Pill tone={c.noticePeriod === "Immediate joiner" ? "success" : "neutral"}>{c.noticePeriod}</Pill>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
          {c.skills.map((s) => (
            <SkillTag key={s}>{s}</SkillTag>
          ))}
        </div>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6, maxWidth: 640 }}>
          {c.reasoning}
        </div>
        <CtcLine ctc={c.ctc} />
        <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkFaint, marginTop: 6 }}>{c.visibility}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
        {readOnly ? (
          <Pill tone="neutral">Requirement closed</Pill>
        ) : c.unlocked ? (
          <OutlineCta size="sm">View contact</OutlineCta>
        ) : (
          <OutlineCta size="sm" tone="indigo" icon={<Icon.Lock />}>
            Unlock contact
          </OutlineCta>
        )}
      </div>
    </div>
  );
}

function ShortlistShell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Shell active="requirements">
      <PageHeading
        eyebrow="Senior Backend Engineer — Payments"
        title="Your shortlist"
        action={action ?? <OutlineCta size="sm">Edit requirement</OutlineCta>}
      />
      {children}
    </Shell>
  );
}

function TrustFooter() {
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>{FAIRNESS_LINE}</div>
      <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>{CONSENT_LINE}</div>
    </div>
  );
}

function ShortlistResults() {
  return (
    <ShortlistShell
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <OutlineCta size="sm">Compare selected (2)</OutlineCta>
          <OutlineCta size="sm">Edit requirement</OutlineCta>
        </div>
      }
    >
      <Card pad={0} style={{ marginBottom: 16 }}>
        <div style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
            <b style={{ color: t.coal }}>10 candidates</b> matched · ranked by Match score against this requirement,
            highest first
          </div>
          <Pill tone="success">Eligibility: ≥3 sessions · Roster Score ≥70</Pill>
        </div>
        <Divider />
        {candidates.map((c, i) => (
          <div key={c.id}>
            <CandidateRow c={c} comparable />
            {i < candidates.length - 1 && <Divider />}
          </div>
        ))}
      </Card>
      <TrustFooter />
    </ShortlistShell>
  );
}

/* ── 4b. Comparison view (2–3 candidates side by side) ─────────── */

function ComparisonScreen() {
  const compared = candidates.slice(0, 2);
  const rows: { label: string; render: (c: (typeof candidates)[number]) => React.ReactNode }[] = [
    { label: "Match to this role", render: (c) => <ScoreChip score={c.matchScore} /> },
    { label: "Roster Score", render: (c) => `${c.rosterScore} · ${c.sessions} sessions · updated ${c.rosterUpdatedAgo}` },
    { label: "Advisory CTC", render: (c) => `₹${c.ctc.min}–${c.ctc.max} LPA (as of ${CTC_BAND_ASOF})` },
    { label: "Notice period", render: (c) => c.noticePeriod },
    { label: "Visible elsewhere", render: (c) => c.visibility },
    { label: "Skills", render: (c) => c.skills.join(", ") },
  ];
  return (
    <ShortlistShell action={<OutlineCta size="sm">Back to shortlist</OutlineCta>}>
      <Card pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${compared.length}, 1fr)` }}>
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${t.line}` }} />
          {compared.map((c) => (
            <div key={c.id} style={{ padding: "16px 22px", borderBottom: `1px solid ${t.line}`, borderLeft: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.sans, fontSize: 14.5, fontWeight: 700, color: t.coal }}>{c.label}</div>
            </div>
          ))}
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <div style={{ padding: "16px 22px", borderBottom: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.inkSoft }}>
                {row.label}
              </div>
              {compared.map((c) => (
                <div
                  key={c.id + row.label}
                  style={{
                    padding: "16px 22px",
                    borderBottom: `1px solid ${t.line}`,
                    borderLeft: `1px solid ${t.line}`,
                    fontFamily: f.sans,
                    fontSize: 13,
                    color: t.coal,
                    lineHeight: 1.6,
                  }}
                >
                  {row.render(c)}
                </div>
              ))}
            </React.Fragment>
          ))}
          <div style={{ padding: "16px 22px" }} />
          {compared.map((c) => (
            <div key={c.id} style={{ padding: "16px 22px", borderLeft: `1px solid ${t.line}` }}>
              {c.unlocked ? <OutlineCta size="sm">View contact</OutlineCta> : (
                <OutlineCta size="sm" tone="indigo" icon={<Icon.Lock />}>
                  Unlock contact
                </OutlineCta>
              )}
            </div>
          ))}
        </div>
      </Card>
      <TrustFooter />
    </ShortlistShell>
  );
}

/* ── 5. Partial match ──────────────────────────────────────────── */

function PartialMatch() {
  return (
    <ShortlistShell>
      <Card background={t.warning100} border={`1px solid ${t.warning}`} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: t.warning }}>
            <Icon.Alert />
          </span>
          <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>
            <b>6 candidates match.</b> Loosen your experience range or notice-period preference to see more.
          </div>
        </div>
      </Card>
      <Card pad={0}>
        <div style={{ padding: "16px 22px" }}>
          <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
            <b style={{ color: t.coal }}>6 candidates</b> matched · fewer than the usual top 10
          </div>
        </div>
        <Divider />
        {candidates.map((c, i) => (
          <div key={c.id}>
            <CandidateRow c={c} />
            {i < candidates.length - 1 && <Divider />}
          </div>
        ))}
      </Card>
    </ShortlistShell>
  );
}

/* ── 6. Zero match ──────────────────────────────────────────────── */

function ZeroMatch() {
  return (
    <ShortlistShell>
      <Card style={{ textAlign: "center", padding: "56px 40px" }}>
        <IconBadge icon={<Icon.Alert />} bg={t.creamSoft} fg={t.inkSoft} size={44} margin="0 auto 18px" />
        <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal }}>No candidates match this requirement yet</div>
        <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 10, maxWidth: 460, margin: "10px auto 0" }}>
          Nobody in the current roster clears the ≥3-session, Roster Score ≥70 bar for these must-haves. Try loosening
          your experience range, notice-period preference, or must-have skills, or check back as more candidates
          practice.
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "center" }}>
          <OutlineCta>Edit requirement</OutlineCta>
          <PrimaryCta>Adjust filters</PrimaryCta>
        </div>
      </Card>
    </ShortlistShell>
  );
}

/* ── 7. Generation failed ──────────────────────────────────────── */

function IconBadge({
  icon,
  bg = t.error100,
  fg = t.error,
  size = 40,
  margin = "0 auto 16px",
}: {
  icon: React.ReactNode;
  bg?: string;
  fg?: string;
  size?: number;
  margin?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin,
      }}
    >
      {icon}
    </div>
  );
}

function ErrorIconBadge({ size = 40, margin = "0 auto 16px" }: { size?: number; margin?: string }) {
  return <IconBadge icon={<Icon.Alert />} size={size} margin={margin} />;
}

function GenerationFailed() {
  return (
    <ShortlistShell>
      <Card
        style={{ textAlign: "center", padding: "56px 40px", borderLeft: `3px solid ${t.error}` }}
      >
        <ErrorIconBadge />
        <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal }}>We couldn't generate your shortlist right now</div>
        <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 10, maxWidth: 440, margin: "10px auto 0" }}>
          Something went wrong on our end. Your requirement is saved — retry now, or we'll try again automatically.
        </div>
        <div style={{ marginTop: 22 }}>
          <PrimaryCta icon={<Icon.Refresh />}>Retry generation</PrimaryCta>
        </div>
      </Card>
    </ShortlistShell>
  );
}

/* ── 8. Unlock confirm / failed (shared modal scaffold) ────────── */
/* Follows unlockCandidate (Rohit Sharma / #22) consistently through to
   UnlockedContact + OutcomeFeedback below — fixes the identity mismatch
   the design review flagged (modal showed #22, reveal showed #14). */

function UnlockModalShell({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <ShortlistShell>
      <div style={{ position: "relative" }}>
        <Card pad={0} style={{ filter: "blur(2px)", opacity: 0.5 }}>
          {candidates.map((c, i) => (
            <div key={c.id}>
              <CandidateRow c={c} />
              {i < candidates.length - 1 && <Divider />}
            </div>
          ))}
        </Card>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(14,12,8,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
          }}
        >
          <Card style={{ width: 400, boxShadow: shadows.modal, borderLeft: accent ? `3px solid ${accent}` : undefined }}>
            {children}
          </Card>
        </div>
      </div>
    </ShortlistShell>
  );
}

function UnlockConfirm() {
  return (
    <UnlockModalShell>
      <Eyebrow tone="indigo">Unlock contact</Eyebrow>
      <div style={{ fontFamily: f.serif, fontSize: 22, color: t.coal, margin: "8px 0 4px" }}>
        {unlockCandidate.name} · {unlockCandidate.label}
      </div>
      <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
        This candidate is in the <b>mid-senior</b> band. Unlocking reveals name, email, and phone, and adds them to
        your active pipeline. {unlockCandidate.visibility}.
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "16px 0",
          padding: "12px 14px",
          borderRadius: 10,
          background: t.creamSoft,
        }}
      >
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>Unlock fee ({UNLOCK_FEE_RANGE} range)</span>
        <span style={{ fontFamily: f.mono, fontSize: 15, fontWeight: 700, color: t.coal }}>₹1,499</span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <OutlineCta full>Cancel</OutlineCta>
        <PrimaryCta full>Pay & unlock</PrimaryCta>
      </div>
    </UnlockModalShell>
  );
}

/* ── 8b. Unlock payment failed (modal) ─────────────────────────── */

function UnlockFailed() {
  return (
    <UnlockModalShell accent={t.error}>
      <ErrorIconBadge size={36} margin="0 0 12px" />
      <Eyebrow tone="error">Payment failed</Eyebrow>
      <div style={{ fontFamily: f.serif, fontSize: 22, color: t.coal, margin: "4px 0 4px" }}>
        {unlockCandidate.name} · {unlockCandidate.label}
      </div>
      <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
        Your bank declined the ₹1,499 unlock charge for {unlockCandidate.name}. No amount was deducted — try again or
        use a different payment method.
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "16px 0",
          padding: "12px 14px",
          borderRadius: 10,
          background: t.creamSoft,
        }}
      >
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>Unlock fee</span>
        <span style={{ fontFamily: f.mono, fontSize: 15, fontWeight: 700, color: t.coal }}>₹1,499</span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <OutlineCta full>Cancel</OutlineCta>
        <PrimaryCta full icon={<Icon.Refresh />}>
          Retry
        </PrimaryCta>
      </div>
    </UnlockModalShell>
  );
}

/* ── 9. Unlocked contact ───────────────────────────────────────── */

function UnlockedContact() {
  return (
    <ShortlistShell>
      <Card style={{ marginBottom: 16 }} background={t.success100} border={`1px solid ${t.successLine}`}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: t.success }}>
            <Icon.Check />
          </span>
          <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>Contact unlocked — added to your active pipeline.</div>
        </div>
      </Card>
      <Card>
        <div style={{ display: "flex", gap: 20 }}>
          <ScoreChip score={unlockCandidate.matchScore} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 700, color: t.coal }}>{unlockCandidate.name}</div>
            <div style={{ fontFamily: f.mono, fontSize: 12.5, color: t.inkSoft, marginTop: 6 }}>
              rohit.sharma@example.com · +91 98xxxxxx22
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
              {unlockCandidate.skills.map((s) => (
                <SkillTag key={s}>{s}</SkillTag>
              ))}
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>{unlockCandidate.noticePeriod}</div>
          </div>
          <OutlineCta size="sm" tone="indigo">Message candidate</OutlineCta>
        </div>
      </Card>
      <Card style={{ marginTop: 16 }} background={t.creamSoft}>
        <Eyebrow tone="copper">Help us improve the roster</Eyebrow>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 8, marginBottom: 12 }}>
          Once you've interviewed {unlockCandidate.name}, tell us the outcome — it keeps Roster Scores honest and, with
          your permission, becomes a case study other employers can see.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <OutlineCta size="sm">Interviewed</OutlineCta>
          <OutlineCta size="sm">Hired</OutlineCta>
          <OutlineCta size="sm">Not a fit</OutlineCta>
        </div>
      </Card>
    </ShortlistShell>
  );
}

/* ── 9b. Outcome feedback — promoted from a throwaway line to a real
   flow (this is the highest-value signal in the whole product: scoring
   calibration + marketing case-study fodder) ────────────────────── */

function OutcomeFeedback() {
  return (
    <ShortlistShell action={<OutlineCta size="sm">Back to pipeline</OutlineCta>}>
      <Card style={{ maxWidth: 640 }}>
        <Eyebrow tone="indigo">Outcome feedback</Eyebrow>
        <h1 style={{ fontFamily: f.serif, fontSize: 24, fontWeight: 400, margin: "6px 0 4px", color: t.coal }}>
          How did it go with {unlockCandidate.name}?
        </h1>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginBottom: 22, lineHeight: 1.6 }}>
          This is the single most valuable signal we get — it's how Roster Scores get calibrated against real hiring
          outcomes, not just practice sessions.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Outcome</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill tone="indigo" filled>Hired</Pill>
              <Pill tone="neutral">Offer extended</Pill>
              <Pill tone="neutral">Interviewed, not a fit</Pill>
              <Pill tone="neutral">No response</Pill>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <FieldLabel>Offered CTC</FieldLabel>
              <input
                readOnly
                value="₹27 LPA"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box" }}
              />
              <HelpText>
                Advisory CTC shown was ₹{unlockCandidate.ctc.min}–{unlockCandidate.ctc.max} LPA — this closes the loop
                on how accurate that estimate was.
              </HelpText>
            </div>
            <div>
              <FieldLabel>Start date</FieldLabel>
              <input
                readOnly
                value="15 Sep 2026"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Anything else worth flagging?</FieldLabel>
            <textarea
              readOnly
              rows={3}
              placeholder="Optional — e.g. strong on system design in the real interview too"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box", resize: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Checkbox label="OK to feature this as an anonymized case study" />
            <PrimaryCta>Submit feedback</PrimaryCta>
          </div>
        </div>
      </Card>
    </ShortlistShell>
  );
}

/* ── 10. Requirement closed (read-only shortlist) ──────────────── */

function RequirementClosed() {
  return (
    <ShortlistShell action={<OutlineCta size="sm">Duplicate this requirement</OutlineCta>}>
      <Card style={{ marginBottom: 16 }} background={t.creamSoft}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: t.inkFaint }}>
            <Icon.Lock />
          </span>
          <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>
            <b>This requirement is closed.</b> The shortlist below is read-only — contacts can no longer be unlocked.
            Hiring for this role again? Duplicate it to re-search the roster with the same must-haves.
          </div>
        </div>
      </Card>
      <Card pad={0}>
        {candidates.map((c, i) => (
          <div key={c.id}>
            <CandidateRow c={c} readOnly />
            {i < candidates.length - 1 && <Divider />}
          </div>
        ))}
      </Card>
    </ShortlistShell>
  );
}

/* ── 0. Employers marketing page + login (top of funnel) ───────── */

function MarketingTopBar() {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 48px" }}>
      <Wordmark />
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <span style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>For candidates</span>
        <OutlineCta size="sm">Log in</OutlineCta>
      </div>
    </header>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.7 26.7 37.5 24 37.5c-5.3 0-9.6-3.1-11.3-7.4l-6.6 5.1C9.6 40.6 16.2 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.7-2.7 5-5 6.5l6.2 5.2C39.9 36.9 43 31.3 43 24c0-1.4-.1-2.5-.4-3.5z" />
    </svg>
  );
}

function EmployersLanding() {
  const features = [
    { title: "Scored, not guessed", body: "Every candidate carries a Roster Score from real graded mock interviews — not a self-reported resume claim. Scoring never sees name, gender, or college." },
    { title: "Ranked shortlists in minutes", body: "Post a role once. We match and rank every eligible candidate against it, with reasoning for each — plus a separate lifetime Roster Score so you can judge how much to trust it." },
    { title: "Pay only to unlock", body: `Browse full shortlists for free. Pay ${UNLOCK_FEE_RANGE}, depending on seniority band, only when you want a candidate's contact details.` },
  ];
  return (
    <div style={{ minHeight: "100%", background: t.cream }}>
      <MarketingTopBar />
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: "40px 24px 0" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 28,
            padding: "6px 16px",
            background: t.copperSoft,
            border: "1px solid rgba(180,83,9,0.18)",
            borderRadius: 999,
            fontFamily: f.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            color: t.copper,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.copper, display: "inline-block" }} />
          Hiring on HireStepX
        </div>
        <h1
          style={{
            fontFamily: f.serif,
            fontSize: "clamp(40px, 5vw, 64px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: t.coal,
            fontWeight: 400,
            margin: 0,
          }}
        >
          Skip the resume pile.
          <br />
          <span style={{ fontStyle: "italic", color: t.copper }}>See who can actually do the job.</span>
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.62, color: t.inkSoft, maxWidth: 560, margin: "22px auto 0" }}>
          Every candidate on the roster has already practiced real mock interviews and opted in to being shown to
          employers. Post a requirement, get a ranked shortlist with reasoning — in under a minute.
        </p>
        <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center" }}>
          <PrimaryCta>Apply as an employer</PrimaryCta>
          <OutlineCta>See how it works</OutlineCta>
        </div>
        <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 12, letterSpacing: "0.01em" }}>
          Free to browse the roster · {UNLOCK_FEE_RANGE} to unlock contact details, depending on seniority band
        </p>
      </div>
      <div style={{ maxWidth: 1080, margin: "56px auto 0", padding: "0 32px 64px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {features.map((feature) => (
          <Card key={feature.title}>
            <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal, marginBottom: 8 }}>{feature.title}</div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>{feature.body}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AuthTopBar({ prompt, linkLabel }: { prompt: string; linkLabel: string }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 48px" }}>
      <Wordmark />
      <div style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>
        {prompt} <span style={{ color: t.indigo, fontWeight: 600 }}>{linkLabel}</span>
      </div>
    </header>
  );
}

function CompanyLogin() {
  return (
    <div style={{ minHeight: "100%", background: t.cream, display: "flex", flexDirection: "column" }}>
      <AuthTopBar prompt="Don't have an account?" linkLabel="Sign up" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 24px 64px" }}>
        <div style={{ width: "100%", textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: "clamp(36px, 5vw, 56px)",
              lineHeight: 1.05,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: t.coal,
              margin: 0,
            }}
          >
            Hire from a roster that's{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>already interview-ready</em>.
          </h1>
          <p style={{ fontFamily: f.sans, fontSize: 16, lineHeight: 1.55, color: t.inkSoft, marginTop: 18 }}>
            Log in with your HireStepX account to apply for employer access — it's the same login you'd use to
            practice interviews.
          </p>
        </div>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <button
            type="button"
            style={{
              width: "100%",
              fontFamily: f.sans,
              fontSize: 15,
              fontWeight: 500,
              color: t.coal,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 10,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              boxShadow: shadows.card,
              cursor: "pointer",
            }}
          >
            <GoogleGlyph />
            Continue with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: t.line }} />
            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>OR</span>
            <div style={{ flex: 1, height: 1, background: t.line }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <FieldLabel required>Email Address</FieldLabel>
              <input
                readOnly
                value="priya@acmefintech.com"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, color: t.coal, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <FieldLabel required>Password</FieldLabel>
              <input
                readOnly
                type="password"
                value="********"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Checkbox label="Stay signed in" />
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.indigo, fontWeight: 600 }}>Forgot password?</span>
            </div>
            <PrimaryCta full>Log in</PrimaryCta>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 11. Company registration / approval ───────────────────────── */

function GateShell({ children, maxWidth = 640 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ minHeight: "100%", background: t.cream, display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px" }}>
      <div style={{ marginBottom: 36 }}>
        <Wordmark />
      </div>
      <div style={{ width: "100%", maxWidth }}>{children}</div>
    </div>
  );
}

function CompanyOnboarding() {
  return (
    <GateShell>
      <Card>
        <Eyebrow tone="indigo">Company profile</Eyebrow>
        <h1 style={{ fontFamily: f.serif, fontSize: 24, fontWeight: 400, margin: "6px 0 4px", color: t.coal }}>
          Tell us about your company
        </h1>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginBottom: 22, lineHeight: 1.6 }}>
          We verify every employer before they can post requirements or unlock candidate contacts — usually within one
          business day.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Company name</FieldLabel>
            <input
              readOnly
              value="Acme Fintech Pvt Ltd"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, color: t.coal, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <FieldLabel required>Industry</FieldLabel>
              <input
                readOnly
                value="Fintech / Payments"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <FieldLabel required>Company size</FieldLabel>
              <input
                readOnly
                value="51–200 employees"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            <FieldLabel required>Work email domain</FieldLabel>
            <input
              readOnly
              value="acmefintech.com"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${t.lineStrong}`, fontFamily: f.sans, fontSize: 13.5, boxSizing: "border-box" }}
            />
            <HelpText>We confirm you work there before approving — use your official company email.</HelpText>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <PrimaryCta icon={<Icon.Building />}>Submit for approval</PrimaryCta>
          </div>
        </div>
      </Card>
    </GateShell>
  );
}

function CompanyPending() {
  return (
    <GateShell maxWidth={520}>
      <Card style={{ textAlign: "center", padding: "48px 36px" }}>
        <IconBadge icon={<Icon.Clock />} bg={t.indigo100} fg={t.indigoDeep} size={44} margin="0 auto 18px" />
        <div style={{ marginBottom: 10 }}>
          <Pill tone="indigo">Pending approval</Pill>
        </div>
        <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal }}>Acme Fintech Pvt Ltd is under review</div>
        <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
          We're verifying your company details — this usually takes under one business day. You'll get an email the
          moment you're approved, and can post hiring requirements right away.
        </div>
        <div style={{ margin: "22px 0" }}>
          <Divider />
        </div>
        <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
          Submitted 4 hours ago · Need this faster?{" "}
          <span style={{ color: t.indigo, fontWeight: 600 }}>Contact support</span>
        </div>
      </Card>
    </GateShell>
  );
}

function CompanyRejected() {
  return (
    <GateShell maxWidth={520}>
      <Card style={{ textAlign: "center", padding: "48px 36px", borderLeft: `3px solid ${t.error}` }}>
        <ErrorIconBadge size={44} margin="0 auto 18px" />
        <div style={{ marginBottom: 10 }}>
          <Pill tone="error">Not approved</Pill>
        </div>
        <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal }}>We couldn't verify this company</div>
        <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 10, lineHeight: 1.6, textAlign: "left" }}>
          Your work email domain (<b>acmefintech.com</b>) didn't match any registered business record we could confirm.
          Resubmit with a company email domain and we'll verify manually.
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center" }}>
          <OutlineCta>Contact support</OutlineCta>
          <PrimaryCta icon={<Icon.Building />}>Resubmit details</PrimaryCta>
        </div>
      </Card>
    </GateShell>
  );
}

/* ── Export switch ──────────────────────────────────────────────── */

export default function TalentRosterEmployer({ variant }: { variant: Variant }) {
  switch (variant) {
    case "employers-landing":
      return <EmployersLanding />;
    case "company-login":
      return <CompanyLogin />;
    case "console-empty":
      return <ConsoleEmpty />;
    case "console":
      return <Console />;
    case "post-requirement":
      return <PostRequirement />;
    case "generating":
      return <Generating />;
    case "shortlist":
      return <ShortlistResults />;
    case "comparison":
      return <ComparisonScreen />;
    case "partial-match":
      return <PartialMatch />;
    case "zero-match":
      return <ZeroMatch />;
    case "generation-failed":
      return <GenerationFailed />;
    case "unlock-confirm":
      return <UnlockConfirm />;
    case "unlock-failed":
      return <UnlockFailed />;
    case "unlocked-contact":
      return <UnlockedContact />;
    case "outcome-feedback":
      return <OutcomeFeedback />;
    case "requirement-closed":
      return <RequirementClosed />;
    case "company-onboarding":
      return <CompanyOnboarding />;
    case "company-pending":
      return <CompanyPending />;
    case "company-rejected":
      return <CompanyRejected />;
    default:
      return <ShortlistResults />;
  }
}
