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

const DEAD_COPY: Record<string, { title: string; body: (p: Preview) => string }> = {
  expired: { title: "This invite has expired", body: (p) => `Ask ${p.inviterName ?? "your admin"} to send a new one.` },
  revoked: { title: "This invite was withdrawn", body: (p) => `${p.inviterName ?? "Your admin"} can send you a new invite if it was a mistake.` },
  accepted: { title: "This invite was already used", body: () => "If that was you, log in to get to your team." },
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
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hx-join">
      <style>{joinCss}</style>
      <main>{children}</main>
      <p className="hx-join-note">Invites work once and only for the email they were sent to.</p>
    </div>
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
    // The page is no-referrer so the token never leaks, but the API's GET origin check needs a Referer;
    // same-origin sends one to our own API only.
    fetch(`/api/employer-team-accept?token=${encodeURIComponent(token)}`, { signal: ctl.signal, referrerPolicy: "same-origin" })
      .then(async (res) => {
        if (res.status === 404) { setPhase({ kind: "invalid" }); return; }
        const data = (await res.json().catch(() => null)) as (Preview & { error?: string }) | null;
        if (!res.ok || !data) {
          const message = res.status === 403
            ? "We couldn't verify this request from your browser. Reload the page, or open the link from your invite email again."
            : data?.error || "Something went wrong. Please try again.";
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
      <Shell>
        <Hero title="We couldn't find this invite" subtitle="The link may be incomplete or no longer valid. Ask the person who invited you to send it again." />
        <Link href="/login" className="hx-btn alt">Go to log in</Link>
      </Shell>
    );
  }

  if (phase.kind === "error") {
    return (
      <Shell>
        <Hero title="Something went wrong" subtitle={<span role="alert">{phase.message}</span>} />
        <button type="button" className="hx-btn alt" onClick={() => window.location.reload()}>Try again</button>
      </Shell>
    );
  }

  const p = phase.preview;
  if (p.state !== "pending") {
    const copy = DEAD_COPY[p.state];
    return (
      <Shell>
        <Hero title={copy.title} subtitle={copy.body(p)} />
        <Link href="/login" className="hx-btn alt">Go to log in</Link>
      </Shell>
    );
  }

  const next = encodeURIComponent(`/employer/join?token=${token}`);
  const emailMatches = !!user?.email && user.email.toLowerCase() === p.email.toLowerCase();
  const wrongAccount = isLoggedIn && !!user && !emailMatches;

  return (
    <Shell>
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
