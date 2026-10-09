"use client";

/* Candidate Referrals screen. The loop itself already exists server-side
   (/api/referral issues the code + stats and rewards BOTH sides on signup,
   /api/referral-invites lists who joined) — this is its dedicated home, so
   sharing is no longer only reachable from a good session report.
   Layout mirrors the job detail / employer screens: flat white 16px panels
   in a main column plus a narrow side column. */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  GiftIcon,
  UsersIcon,
  UserCheckIcon,
  TicketIcon,
  CopyIcon,
  CheckIcon,
  MailIcon,
  MessageCircleIcon,
  Share2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, referralSignupUrl } from "./AuthContext";
import { authHeaders } from "./supabase";
import { captureClientEvent } from "./posthogClient";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import { daysAgo } from "./hiringMatchFormat";
import { ReferralsRouteSkeleton } from "./routeSkeletons";
import {
  SESSIONS_PER_REFERRAL,
  buildShareMessage,
  freeSessionsEarned,
  inviteStatusLabel,
  linkedInShareUrl,
  mailtoShareUrl,
  whatsAppShareUrl,
  type InviteStatus,
  type ReferralStats,
} from "./referralShare";

interface ReferralInvite {
  id: string;
  name: string;
  email: string;
  status: InviteStatus;
  createdAt: string;
}

const PANEL_STYLE = { background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: 24, minWidth: 0 } as const;
const SECTION_HEADING_STYLE = { fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 } as const;

function IconTile({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) {
  return (
    <div style={{ width: 28, height: 28, borderRadius: 8, background: tone === "brand" ? t.indigo100 : t.creamSoft, color: tone === "brand" ? t.indigo : t.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <IconTile>{icon}</IconTile>
      <span style={{ flex: 1, fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft }}>{label}</span>
      <span style={{ fontFamily: f.sans, fontSize: textSize.xl, fontWeight: 700, color: t.coal, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function StatusChip({ status }: { status: InviteStatus }) {
  const style =
    status === "rewarded" ? { color: t.successInk, background: t.success100 }
    : status === "redeemed" ? { color: t.indigoDeep, background: t.indigo100 }
    : { color: t.inkSoft, background: t.creamSoft };
  return (
    <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", ...style }}>
      {inviteStatusLabel(status)}
    </span>
  );
}

const STEPS = [
  { title: "Share your link", body: "Send it to a friend who is preparing for interviews." },
  { title: "They sign up", body: "They create a free HireStepX account using your link." },
  { title: "You both get a session", body: `Each of you gets ${SESSIONS_PER_REFERRAL} free practice session, credited instantly.` },
];

export default function DashboardReferrals() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(user?.referralCode ?? null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    try {
      const headers = await authHeaders();
      const [refRes, invRes] = await Promise.all([
        fetch("/api/referral", { headers }),
        fetch("/api/referral-invites", { headers }),
      ]);
      const ref = refRes.ok ? await refRes.json().catch(() => null) : null;
      const inv = invRes.ok ? await invRes.json().catch(() => null) : null;
      if (signal.cancelled) return;
      if (ref?.code) {
        setCode(ref.code);
        setStats(ref.stats ?? null);
      }
      setInvites(Array.isArray(inv?.invites) ? inv.invites : []);
      setFailed(!ref?.code);
    } catch {
      if (!signal.cancelled) setFailed(true);
    }
    if (!signal.cancelled) setLoaded(true);
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  const link = code ? referralSignupUrl(code) : "";
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const track = (channel: string) => captureClientEvent("referral_invite_sent", { surface: "referrals_page", channel });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track("copy");
    } catch { /* clipboard unavailable (insecure context / denied) — the link is selectable in the field */ }
  };

  const open = (url: string, channel: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    track(channel);
  };

  const onNativeShare = async () => {
    try {
      await navigator.share({ title: "HireStepX", text: buildShareMessage(link), url: link });
      track("native");
    } catch { /* user dismissed the share sheet */ }
  };

  if (!loaded && !code) return <ReferralsRouteSkeleton />;

  const shareBtn = { display: "inline-flex", alignItems: "center", gap: 8 } as const;
  const safeStats: ReferralStats = stats ?? { total: invites.length, redeemed: invites.filter((i) => i.status !== "pending").length, rewarded: invites.filter((i) => i.status === "rewarded").length };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", width: "100%", fontFamily: f.sans }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "3 1 min(560px, 100%)", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <section aria-labelledby="referral-title" style={PANEL_STYLE}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: t.indigo100, color: t.indigo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <GiftIcon size={22} aria-hidden="true" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 id="referral-title" style={{ fontFamily: f.sans, fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: t.coal, margin: 0 }}>
                  Give a session, get a session
                </h1>
                <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: "6px 0 0", lineHeight: 1.5 }}>
                  When a friend joins with your link, you both get a free practice session. No purchase needed.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <label htmlFor="referral-link" style={{ ...SECTION_HEADING_STYLE, display: "block", marginBottom: 8 }}>Your referral link</label>
              {failed && !code ? (
                <div role="alert" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: t.inkSoft, fontSize: 13.5 }}>
                  <AlertCircleIcon size={16} color={t.error} aria-hidden="true" />
                  <span>We couldn't load your referral link. This is usually temporary.</span>
                  <Button variant="outline" size="sm" onClick={() => { setLoaded(false); setFailed(false); load({ cancelled: false }); }}>Try again</Button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      id="referral-link"
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      style={{ flex: "1 1 240px", minWidth: 0, height: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${t.line}`, background: t.creamSoft, color: t.coal, fontFamily: f.sans, fontSize: 16 }}
                    />
                    <Button type="button" onClick={onCopy} disabled={!code} style={shareBtn}>
                      {copied ? <CheckIcon size={15} aria-hidden="true" /> : <CopyIcon size={15} aria-hidden="true" />}
                      {copied ? "Link copied" : "Copy link"}
                    </Button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <Button type="button" variant="outline" size="sm" disabled={!code} onClick={() => open(whatsAppShareUrl(link), "whatsapp")} style={shareBtn}>
                      <MessageCircleIcon size={14} aria-hidden="true" /> WhatsApp
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!code} onClick={() => open(linkedInShareUrl(link), "linkedin")} style={shareBtn}>
                      <Share2Icon size={14} aria-hidden="true" /> LinkedIn
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!code} onClick={() => open(mailtoShareUrl(link), "email")} style={shareBtn}>
                      <MailIcon size={14} aria-hidden="true" /> Email
                    </Button>
                    {canNativeShare && (
                      <Button type="button" variant="outline" size="sm" disabled={!code} onClick={onNativeShare} style={shareBtn}>
                        <Share2Icon size={14} aria-hidden="true" /> More
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="referral-invites-heading" style={PANEL_STYLE}>
            <h2 id="referral-invites-heading" style={SECTION_HEADING_STYLE}>Your invites</h2>
            {invites.length === 0 ? (
              <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: "8px 0 0", lineHeight: 1.55 }}>
                No one has joined with your link yet. Share it above and they will show up here.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column" }}>
                {invites.map((inv, i) => (
                  <li key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${t.line}`, minWidth: 0 }}>
                    <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: t.indigo100, color: t.indigo, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                      {(inv.name[0] || "?").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, overflowWrap: "anywhere" }}>{inv.name}</div>
                      <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, overflowWrap: "anywhere" }}>
                        {inv.email ? `${inv.email} · ` : ""}{daysAgo(inv.createdAt)}
                      </div>
                    </div>
                    <StatusChip status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div style={{ flex: "1 1 260px", minWidth: 260, maxWidth: 340, display: "flex", flexDirection: "column", gap: 16 }}>
          <section aria-labelledby="referral-impact-heading" style={{ ...PANEL_STYLE, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 id="referral-impact-heading" style={SECTION_HEADING_STYLE}>Your impact</h2>
            <StatRow icon={<UsersIcon size={15} aria-hidden="true" />} label="Friends invited" value={safeStats.total} />
            <StatRow icon={<UserCheckIcon size={15} aria-hidden="true" />} label="Friends joined" value={safeStats.redeemed} />
            <StatRow icon={<TicketIcon size={15} aria-hidden="true" />} label="Free sessions earned" value={freeSessionsEarned(safeStats)} />
          </section>

          <section aria-labelledby="referral-how-heading" style={PANEL_STYLE}>
            <h2 id="referral-how-heading" style={SECTION_HEADING_STYLE}>How it works</h2>
            <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {STEPS.map((s, i) => (
                <li key={s.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <IconTile tone="brand"><span style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 700 }}>{i + 1}</span></IconTile>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal }}>{s.title}</div>
                    <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 2, lineHeight: 1.5 }}>{s.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
