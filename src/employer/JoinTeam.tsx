"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/apiClient";
import { useAuth } from "@/AuthContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { initialsOf, PersonAvatar, RoleBadge } from "./team/TeamParts";
import { ROLE_BLURB, ROLE_LABEL, isEmployerRole, type EmployerRole } from "../../server-handlers/_employer-team-helpers";

interface Preview {
  state: "pending" | "expired" | "revoked" | "accepted";
  companyName: string;
  role: EmployerRole;
  email: string;
  inviterName: string | null;
}

type Phase =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "error"; message: string }
  | { kind: "ready"; preview: Preview };

const DEAD_COPY: Record<string, { glyph: keyof typeof GLYPHS; title: string; body: (p: Preview) => string; cta: string }> = {
  expired: { glyph: "clock", title: "This invite has expired", body: (p) => `Invites last 7 days. Ask ${p.inviterName ?? "your admin"} to send you a new one.`, cta: "Go to log in" },
  revoked: { glyph: "ban", title: "This invite was withdrawn", body: (p) => `${p.inviterName ?? "Your admin"} can send you a new invite if it was a mistake.`, cta: "Go to log in" },
  accepted: { glyph: "check", title: "This invite was already used", body: () => "If that was you, log in to get to your team.", cta: "Log in to your team" },
};

const ACCEPT_ERROR_TITLE: Record<string, string> = {
  invalid: "We couldn't find this invite",
  expired: "This invite has expired",
  revoked: "This invite was withdrawn",
  used: "This invite was already used",
  already_member: "You're already on a team",
  team_full: "This team is full",
  suspended: "This company can't add people right now",
  email_mismatch: "This invite is for a different email",
};

/* Rendered inside AuthSkin (see the page), so the heading, card and wordmark match /login and /signup.
   Only the pieces the skin has no opinion on live here. */
const joinCss = `
.hx-join-hero { margin-bottom: 24px; }
.hx-join-subtitle { text-align: center; color: var(--ink-2); }
.hx-join .hx-btn { width: 100%; min-height: 48px; cursor: pointer; }
.hx-join button.hx-btn { font-family: inherit; }
.hx-join button.hx-btn:disabled { opacity: .5; cursor: not-allowed; }
.hx-join-note { margin: 28px 0 0; text-align: center; color: var(--ink-3); }
.hx-join-end { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 0 4px; }
.hx-join-end .hx-join-hero { margin-bottom: 28px; }
.hx-join-end h1 { font-size: 32px !important; }
.hx-join-end .hx-join-subtitle { max-width: 440px; margin-left: auto; margin-right: auto; }
.hx-join-end .hx-btn { width: auto; min-width: 220px; padding: 0 32px; }
.hx-join-end-help { margin: 20px 0 0; color: var(--ink-3); }
.hx-join-end-help a { color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; }
.hx-join-glyph { width: 56px; height: 56px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; background: ${t.indigo100}; color: ${t.indigoDeep}; }
`;

function Shell({ children, note = false }: { children: React.ReactNode; note?: boolean }) {
  return (
    <div className="hx-join">
      <style>{joinCss}</style>
      <main>{children}</main>
      {note && <p className="hx-join-note">Invites work once and only for the email they were sent to.</p>}
    </div>
  );
}

const GLYPHS: Record<"link" | "clock" | "ban" | "check" | "alert", React.ReactNode> = {
  link: <><path d="M9 17H7a5 5 0 0 1 0-10h2" /><path d="M15 7h2a5 5 0 0 1 4 8" /><path d="M8 12h4" /><path d="m3 3 18 18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4" /><path d="M12 17.5v.01" /></>,
};

/* Every dead end (bad link, expired, withdrawn, used, server trouble) shares one calm layout:
   a glyph, a short reason, one obvious next step. */
function DeadEnd({ glyph, title, subtitle, action, help }: {
  glyph: keyof typeof GLYPHS; title: string; subtitle: React.ReactNode; action: React.ReactNode; help?: React.ReactNode;
}) {
  return (
    <Shell>
      <div className="hx-join-end">
        <span className="hx-join-glyph" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{GLYPHS[glyph]}</svg>
        </span>
        <Hero title={title} subtitle={subtitle} />
        {action}
        {help && <p className="hx-join-end-help">{help}</p>}
      </div>
    </Shell>
  );
}

function Hero({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="hx-join-hero">
      <h1>{title}</h1>
      {subtitle && <p className="hx-join-subtitle">{subtitle}</p>}
    </div>
  );
}

/** Top-right link of the auth skin; keeps the invite URL as the post-login destination. */
export function JoinTopLink() {
  const token = useSearchParams()?.get("token") ?? "";
  const next = token ? `?next=${encodeURIComponent(`/employer/join?token=${token}`)}` : "";
  return <>Have an account? <a href={`/login${next}`}>Log in</a></>;
}

const body: React.CSSProperties = { fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: "8px 0 0", lineHeight: 1.6 };

export default function JoinTeam() {
  const token = useSearchParams()?.get("token") ?? "";
  const { user, isLoggedIn, loading: authLoading, logout } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code?: string; message: string } | null>(null);

  useEffect(() => {
    if (!token) { setPhase({ kind: "invalid" }); return; }
    const ctl = new AbortController();
    fetch(`/api/employer-team-accept?token=${encodeURIComponent(token)}`, { signal: ctl.signal })
      .then(async (res) => {
        if (res.status === 404) { setPhase({ kind: "invalid" }); return; }
        const data = (await res.json().catch(() => null)) as (Preview & { error?: string }) | null;
        if (!res.ok || !data) {
          const message = data?.error || "Something went wrong. Please try again.";
          setPhase({ kind: "error", message });
          return;
        }
        setPhase({ kind: "ready", preview: { ...data, role: isEmployerRole(data.role) ? data.role : "viewer" } });
      })
      .catch((err) => { if ((err as Error).name !== "AbortError") setPhase({ kind: "error", message: "Couldn't reach our servers. Check your connection." }); });
    return () => ctl.abort();
  }, [token]);

  const accept = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    const res = await apiFetch<{ ok: boolean }>("/api/employer-team-accept", { token }, { method: "POST" });
    if (res.ok) { window.location.assign("/employer"); return; }
    const err = res.errorData as { error?: string; code?: string } | null;
    setProblem({ code: err?.code, message: err?.error || res.error || "Something went wrong. Please try again." });
    setBusy(false);
  }, [token]);

  if (phase.kind === "loading" || authLoading) {
    return (
      <Shell>
        <div role="status" aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="sr-only">Loading invite…</span>
          <Skeleton style={{ height: 44, width: 44, borderRadius: 12 }} />
          <Skeleton style={{ height: 28, width: "80%", borderRadius: 6 }} />
          <Skeleton style={{ height: 16, width: "95%", borderRadius: 6 }} />
          <Skeleton style={{ height: 40, width: "100%", borderRadius: 10 }} />
        </div>
      </Shell>
    );
  }

  if (phase.kind === "invalid") {
    return (
      <DeadEnd
        glyph="link"
        title="We couldn't find this invite"
        subtitle="The link may be incomplete or no longer valid. Ask the person who invited you to send it again."
        action={<Link href="/login" className="hx-btn">Go to log in</Link>}
        help={<>Copied the link by hand? Open it straight from the invite email.</>}
      />
    );
  }

  if (phase.kind === "error") {
    return (
      <DeadEnd
        glyph="alert"
        title="Something went wrong"
        subtitle={<span role="alert">{phase.message}</span>}
        action={<button type="button" className="hx-btn" onClick={() => window.location.reload()}>Try again</button>}
      />
    );
  }

  const p = phase.preview;
  if (p.state !== "pending") {
    const copy = DEAD_COPY[p.state];
    return (
      <DeadEnd
        glyph={copy.glyph}
        title={copy.title}
        subtitle={copy.body(p)}
        action={<Link href="/login" className="hx-btn">{copy.cta}</Link>}
      />
    );
  }

  const next = encodeURIComponent(`/employer/join?token=${token}`);
  const emailMatches = !!user?.email && user.email.toLowerCase() === p.email.toLowerCase();
  const wrongAccount = isLoggedIn && !!user && !emailMatches;

  return (
    <Shell note>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
        <span
          aria-hidden="true"
          style={{ width: 52, height: 52, borderRadius: 14, background: t.indigo100, color: t.indigoDeep, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: f.sans, fontSize: 18, fontWeight: 600 }}
        >
          {initialsOf(p.companyName || "?")}
        </span>
        {p.inviterName && (
          <>
            <span aria-hidden="true" style={{ color: t.inkFaintWeak }}>←</span>
            <PersonAvatar seed={p.inviterName} label={p.inviterName} size={36} />
          </>
        )}
      </div>

      <Hero
        title={`Join ${p.companyName || "this company"} on HireStepX`}
        subtitle={p.inviterName ? <><strong style={{ color: "var(--ink)", fontWeight: 600 }}>{p.inviterName}</strong> invited you to the hiring team.</> : "You've been invited to the hiring team."}
      />

      <dl style={{ margin: 0, borderTop: `1px solid ${t.line}` }}>
        <Row label="Invited email" value={<span style={{ overflowWrap: "anywhere" }}>{p.email}</span>} />
        <Row label="Your role" value={<RoleBadge role={p.role} />} />
      </dl>
      <p style={{ ...body, fontSize: 13, margin: "12px 0 0", textAlign: "center" }}>{ROLE_LABEL[p.role]}: {ROLE_BLURB[p.role]}</p>

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
        {!isLoggedIn || !user ? (
          <>
            <Link href={`/signup?next=${next}`} className="hx-btn">Create account to join</Link>
            <Link href={`/login?next=${next}`} className="hx-btn alt">I already have an account</Link>
            <p style={{ ...body, fontSize: 13, margin: "4px 0 0", textAlign: "center" }}>Use {p.email} so we can match the invite.</p>
          </>
        ) : wrongAccount ? (
          <>
            <p role="alert" style={{ ...body, margin: 0, color: t.errorInk, textAlign: "center" }}>
              You&apos;re signed in as {user.email}, but this invite is for {p.email}.
            </p>
            <button type="button" className="hx-btn" onClick={() => { void logout().then(() => window.location.assign(`/login?next=${next}`)); }}>
              Switch account
            </button>
          </>
        ) : (
          <>
            {problem && (
              <p role="alert" style={{ ...body, margin: 0, color: t.errorInk, textAlign: "center" }}>
                <strong style={{ fontWeight: 600 }}>{ACCEPT_ERROR_TITLE[problem.code ?? ""] ?? "Couldn't join"}.</strong> {problem.message}
              </p>
            )}
            {problem?.code === "already_member" ? (
              <Link href="/employer" className="hx-btn">Go to your dashboard</Link>
            ) : (
              <button type="button" className="hx-btn" disabled={busy} onClick={() => void accept()}>
                {busy ? "Joining…" : `Join ${p.companyName || "team"}`}
              </button>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: `1px solid ${t.line}` }}>
      <dt style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: 0 }}>{label}</dt>
      <dd style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal, margin: 0, textAlign: "right", minWidth: 0 }}>{value}</dd>
    </div>
  );
}
