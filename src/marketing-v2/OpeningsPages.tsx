"use client";
import { useEffect } from "react";
import type { CSSProperties } from "react";
import { tokens as t, fonts } from "../auth/_tokens";
import { captureClientEvent } from "../posthogClient";
import { PageShell, PageHero, ctaPrimary, ctaGhost, container, containerNarrow, h3, body } from "./MarketingPagesV2";
import {
  experienceLabel, practiseHref, WORK_MODE_LABEL, type PublicOpening,
} from "../../server-handlers/_public-openings-helpers";

/* Public, anonymous role pages. Copy that makes a promise to candidates is
   deliberately in one place (TRUST) so it can be reviewed in one read. */
const TRUST = {
  anonymous: "Employers stay private until you have practised and chosen to share your profile.",
  posted: "Posted by an employer on HireStepX.",
  noApply: "Signing up does not apply you. Employers read your scored answers.",
} as const;

const chip: CSSProperties = {
  fontFamily: fonts.sans, fontSize: 13, fontWeight: 500, color: t.coal,
  padding: "6px 12px", borderRadius: 999, border: `1px solid ${t.lineStrong}`, background: t.creamSoft,
};

const card: CSSProperties = {
  display: "block", padding: 24, borderRadius: 12, border: `1px solid ${t.line}`,
  background: t.cream, textDecoration: "none", color: "inherit",
};

function Facts({ o }: { o: PublicOpening }) {
  const exp = experienceLabel(o.experienceMin, o.experienceMax);
  const items = [o.location, o.workMode ? WORK_MODE_LABEL[o.workMode] : null, exp, o.employmentType === "full-time" ? "Full-time" : o.employmentType].filter(Boolean) as string[];
  return (
    <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((i) => <li key={i} style={chip}>{i}</li>)}
    </ul>
  );
}

function TrustNote({ extra }: { extra?: string }) {
  return (
    <p style={{ ...body, fontSize: 14, color: t.inkSoft, maxWidth: "62ch" }}>
      {TRUST.posted} {TRUST.anonymous}{extra ? ` ${extra}` : ""}
    </p>
  );
}

export function OpeningsIndexPage({ openings }: { openings: PublicOpening[] }) {
  useEffect(() => { captureClientEvent("openings_list_view", { count: openings.length }); }, [openings.length]);
  return (
    <PageShell>
      <PageHero
        eyebrow="Open roles"
        title="Roles hiring on HireStepX"
        lead="Employers list roles here without a company name. Practise for the one you want, and your scored answers do the talking."
        meta={<TrustNote />}
      />
      <section style={{ paddingTop: 48, paddingBottom: 72 }} aria-label="Open roles">
        <div className="mv2-container" style={container}>
          {openings.length === 0 ? (
            <div style={{ ...card, maxWidth: 640 }}>
              <h2 style={{ ...h3, fontSize: 24, margin: "0 0 8px" }}>No roles are listed right now</h2>
              <p style={{ ...body, marginBottom: 20 }}>New roles appear here as employers list them. Practising now gets your scored answers ready.</p>
              <a href="/signup?source=openings" style={ctaPrimary()} className="mv2-tap-44">Start practising</a>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
              {openings.map((o) => (
                <li key={o.slug}>
                  <a href={`/openings/${o.slug}`} style={card} className="mv2-tap-44"
                    onClick={() => captureClientEvent("openings_card_click", { opening: o.slug })}>
                    <h2 style={{ ...h3, fontSize: 22, margin: "0 0 10px" }}>{o.title}</h2>
                    <p style={{ ...body, fontSize: 15, margin: "0 0 16px" }}>{o.summary}</p>
                    <Facts o={o} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}

export function OpeningDetailPage({ opening: o, url }: { opening: PublicOpening; url: string }) {
  useEffect(() => { captureClientEvent("opening_view", { opening: o.slug }); }, [o.slug]);
  const share = `https://wa.me/?text=${encodeURIComponent(`${o.title}, hiring on HireStepX: ${url}`)}`;
  return (
    <PageShell>
      <PageHero
        eyebrow="Hiring on HireStepX"
        title={o.title}
        lead={o.summary}
        meta={
          <div style={{ display: "grid", gap: 20 }}>
            <Facts o={o} />
            <div className="mv2p-cta-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href={practiseHref(o)} style={ctaPrimary("lg")} className="mv2-tap-44"
                onClick={() => captureClientEvent("opening_practise_click", { opening: o.slug, role: o.title })}>
                Practise for this role
              </a>
              <a href={share} target="_blank" rel="noopener noreferrer" style={ctaGhost("lg")} className="mv2-tap-44"
                onClick={() => captureClientEvent("opening_share_click", { opening: o.slug, channel: "whatsapp" })}>
                Share on WhatsApp
              </a>
            </div>
          </div>
        }
      />
      <section style={{ paddingTop: 48, paddingBottom: 72 }}>
        <div className="mv2-container" style={{ ...containerNarrow, display: "grid", gap: 40 }}>
          {o.skills.length > 0 && (
            <div>
              <h2 style={{ ...h3, fontSize: 26, margin: "0 0 12px" }}>What this role is likely to test</h2>
              <p style={{ ...body, marginBottom: 16 }}>Your practice interview for this role leans on these skills.</p>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
                {o.skills.map((s) => <li key={s} style={chip}>{s}</li>)}
              </ul>
            </div>
          )}
          <div>
            <h2 style={{ ...h3, fontSize: 26, margin: "0 0 12px" }}>How it works</h2>
            <ol style={{ ...body, margin: 0, paddingLeft: 22, display: "grid", gap: 8 }}>
              <li>Sign up and start a practice interview set up for this role. No credit card needed.</li>
              <li>Get a scored report with a STAR breakdown and a coached model answer.</li>
              <li>Choose whether to share your profile. Employers only see what you share.</li>
            </ol>
          </div>
          <div>
            <TrustNote extra={TRUST.noApply} />
            <p style={{ ...body, fontSize: 14, color: t.inkSoft, marginTop: 12 }}>
              <a href={`/contact?topic=report-listing&opening=${encodeURIComponent(o.slug)}`} style={{ color: t.inkSoft }}>Report this listing</a>
              {" · "}
              <a href="/openings" style={{ color: t.inkSoft }}>All open roles</a>
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
