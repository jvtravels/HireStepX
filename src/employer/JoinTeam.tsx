"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/apiClient";
import { useAuth } from "@/AuthContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { EmployerWordmark } from "./_atoms";
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: t.pageBg, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 48px" }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 28 }}>
        <Link href="/" aria-label="HireStepX home" style={{ alignSelf: "flex-start" }}><EmployerWordmark /></Link>
        <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: "32px clamp(20px, 6vw, 32px)" }}>{children}</div>
        <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
          Invites work once and only for the email they were sent to.
        </p>
      </div>
    </main>
  );
}

const h1: React.CSSProperties = { fontFamily: f.sans, fontSize: 22, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.015em", lineHeight: 1.25, textWrap: "balance" };
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
        if (!res.ok || !data) { setPhase({ kind: "error", message: data?.error || "Something went wrong. Please try again." }); return; }
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
        <h1 style={h1}>We couldn&apos;t find this invite</h1>
        <p style={body}>The link may be incomplete or no longer valid. Ask the person who invited you to send it again.</p>
        <Button asChild variant="outline" size="lg" className="mt-6 h-10 px-5"><Link href="/login">Go to log in</Link></Button>
      </Shell>
    );
  }

  if (phase.kind === "error") {
    return (
      <Shell>
        <h1 style={h1}>Something went wrong</h1>
        <p role="alert" style={body}>{phase.message}</p>
        <Button type="button" variant="outline" size="lg" className="mt-6 h-10 px-5" onClick={() => window.location.reload()}>Try again</Button>
      </Shell>
    );
  }

  const p = phase.preview;
  if (p.state !== "pending") {
    const copy = DEAD_COPY[p.state];
    return (
      <Shell>
        <h1 style={h1}>{copy.title}</h1>
        <p style={body}>{copy.body(p)}</p>
        <Button asChild variant="outline" size="lg" className="mt-6 h-10 px-5"><Link href="/login">Go to log in</Link></Button>
      </Shell>
    );
  }

  const next = encodeURIComponent(`/employer/join?token=${token}`);
  const emailMatches = !!user?.email && user.email.toLowerCase() === p.email.toLowerCase();
  const wrongAccount = isLoggedIn && !!user && !emailMatches;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span
          aria-hidden="true"
          style={{ width: 44, height: 44, borderRadius: 12, background: t.indigo100, color: t.indigoDeep, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: f.sans, fontSize: 16, fontWeight: 600 }}
        >
          {initialsOf(p.companyName || "?")}
        </span>
        {p.inviterName && (
          <>
            <span aria-hidden="true" style={{ color: t.inkFaintWeak }}>←</span>
            <PersonAvatar seed={p.inviterName} label={p.inviterName} size={32} />
          </>
        )}
      </div>

      <h1 style={h1}>Join {p.companyName || "this company"} on HireStepX</h1>
      <p style={body}>
        {p.inviterName ? <><strong style={{ color: t.coal, fontWeight: 600 }}>{p.inviterName}</strong> invited you to the hiring team.</> : "You've been invited to the hiring team."}
      </p>

      <dl style={{ margin: "20px 0 0", borderTop: `1px solid ${t.line}` }}>
        <Row label="Invited email" value={<span style={{ overflowWrap: "anywhere" }}>{p.email}</span>} />
        <Row label="Your role" value={<RoleBadge role={p.role} />} />
      </dl>
      <p style={{ ...body, fontSize: 13, margin: "10px 0 0" }}>{ROLE_LABEL[p.role]}: {ROLE_BLURB[p.role]}</p>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {!isLoggedIn || !user ? (
          <>
            <Button asChild size="lg" className="h-11 w-full"><Link href={`/signup?next=${next}`}>Create account to join</Link></Button>
            <Button asChild variant="outline" size="lg" className="h-11 w-full"><Link href={`/login?next=${next}`}>I already have an account</Link></Button>
            <p style={{ ...body, fontSize: 12, margin: "4px 0 0", textAlign: "center" }}>Use {p.email} so we can match the invite.</p>
          </>
        ) : wrongAccount ? (
          <>
            <p role="alert" style={{ ...body, margin: 0, color: t.errorInk }}>
              You&apos;re signed in as {user.email}, but this invite is for {p.email}.
            </p>
            <Button type="button" size="lg" className="h-11 w-full" onClick={() => { void logout().then(() => window.location.assign(`/login?next=${next}`)); }}>
              Switch account
            </Button>
          </>
        ) : (
          <>
            {problem && (
              <p role="alert" style={{ ...body, margin: 0, color: t.errorInk }}>
                <strong style={{ fontWeight: 600 }}>{ACCEPT_ERROR_TITLE[problem.code ?? ""] ?? "Couldn't join"}.</strong> {problem.message}
              </p>
            )}
            {problem?.code === "already_member" ? (
              <Button asChild size="lg" className="h-11 w-full"><Link href="/employer">Go to your dashboard</Link></Button>
            ) : (
              <Button type="button" size="lg" className="h-11 w-full" disabled={busy} onClick={() => void accept()}>
                {busy ? "Joining…" : `Join ${p.companyName || "team"}`}
              </Button>
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
