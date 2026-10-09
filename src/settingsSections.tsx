import type React from "react";
import { memo, useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { type PaymentRecord } from "./supabase";
import { useDashboardSubscription } from "./DashboardContext";
import { tokens as t, fonts, shadows } from "./auth/_tokens";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUiSoundsEnabled, setUiSoundsEnabled } from "./uiSounds";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusIcon, XIcon } from "lucide-react";
import { PortfolioLinkIcon, formatPortfolioUrl } from "./portfolioLinkIcons";


/* Local token aliases — same shape as the shared `T` object so JSX
   style values keep compiling. Semantic values reference the shared
   design tokens (src/auth/_tokens.ts) so the hex-gate has a single
   source of truth; only the faint tint fills below (no exact token)
   stay raw. `reward`/`rewardDark` are copper by design: this file
   only uses them for credit-balance/reward visuals, never general
   interactive accents (those use `indigo`). */
const c = {
  surface: t.cream,
  graphite: t.creamRaised,
  border: t.line,
  borderStrong: t.lineStrong,
  reward: t.copper,
  rewardDark: t.copperDark,
  ink: t.coal,
  inkSoft: t.inkSoft,
  sage: t.success,
  ember: t.error,
  indigo: t.indigo,
  indigoDeep: t.indigoDeep,
  indigo100: t.indigo100,
  copper100: t.copper100,
  success100: t.success100,
  error100: t.error100,
  warning100: t.warning100,
  warningInk: t.warningInk,
  cream: t.cream,
  creamSoft: t.creamSoft,
  rowTint: t.rowTint,
};
const font = {
  display: fonts.serif,
  ui: fonts.sans,
  mono: fonts.mono,
};
const shadow = {
  sm: shadows.card,
};

/* ─── Section Icons (shared) ─── */
export const icons = {
  account: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  interview: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>,
  plan: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
};

export function Divider() {
  return (
    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${c.border}, transparent)`, margin: "28px 0" }} />
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT SECTION
   ═══════════════════════════════════════════════════════════════ */

export interface AccountSectionProps {
  // Password
  resetLoading: boolean;
  resetSent: boolean;
  handlePasswordReset: () => void;
  /** True when the signed-in user authenticated via Google (or any
   *  OAuth provider) — they don't have an internal-app password to
   *  reset, so the section hides. Resetting via email link only
   *  changes a password they don't use, which confused users. */
  isOAuthOnly: boolean;
}

export const accSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ink,
  background: c.graphite, border: `1px solid ${c.borderStrong}`, borderRadius: 8,
  padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const accSubtleBtnGhost: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.inkSoft,
  background: "transparent", border: "none", borderRadius: 8,
  padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const dangerSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ember,
  background: "transparent", border: `1px solid ${t.errorLine}`,
  borderRadius: 8, padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const dangerSolidBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
  background: c.ember, border: "none",
  borderRadius: 8, padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const successSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
  background: c.sage, border: `1px solid ${c.sage}`,
  borderRadius: 8, padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const indigoPrimaryBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
  background: c.indigo, border: `1px solid ${c.indigo}`,
  borderRadius: 8, padding: "10px 16px", cursor: "pointer", minHeight: 40,
};

export const indigoGhostBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ink,
  background: c.graphite, border: `1px solid ${c.borderStrong}`,
  borderRadius: 8, padding: "10px 16px", cursor: "pointer", minHeight: 40,
};

export function SectionHead({ kicker: k, title, desc, tone }: { kicker?: string; title: string; desc?: string; tone?: "danger" }) {
  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      {k && (
        <div style={{
          fontFamily: font.mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.18em",
          color: tone === "danger" ? c.ember : c.indigo, textTransform: "uppercase",
        }}>{k}</div>
      )}
      <h2 style={{
        fontFamily: font.ui, fontSize: 28, letterSpacing: "-0.02em",
        color: tone === "danger" ? c.ember : c.ink, margin: "6px 0", lineHeight: 1.15, fontWeight: 400,
      }}>{title}</h2>
      {desc && (
        <p style={{
          fontFamily: font.ui, fontSize: 14, color: c.inkSoft, margin: 0, lineHeight: 1.55, maxWidth: 620,
        }}>{desc}</p>
      )}
    </div>
  );
}

export function EditorialCard({ children, density = "default" }: { children: React.ReactNode; density?: "default" | "tight" }) {
  return (
    <div className="editorial-card" data-density={density} style={{
      background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 14,
      boxShadow: shadow.sm,
      padding: density === "tight" ? "20px 24px" : "28px 32px",
    }}>{children}</div>
  );
}

/* ─── Flat, single-container page shell (Figma: one bordered card,
   sections separated by hairlines rather than individually elevated). ─── */
export function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: "20px 28px", borderBottom: `1px solid ${c.border}` }}>
      <h1 style={{ fontFamily: font.ui, fontSize: 20, fontWeight: 600, color: c.ink, margin: 0, letterSpacing: "-0.01em" }}>{title}</h1>
      <p style={{ fontFamily: font.ui, fontSize: 14, color: c.inkSoft, margin: "4px 0 0" }}>{desc}</p>
    </div>
  );
}

export function FlatSection({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: "24px clamp(16px, 5vw, 104px)", borderBottom: last ? "none" : `1px solid ${c.border}` }}>
      <h2 style={{ fontFamily: font.ui, fontSize: 16, fontWeight: 600, color: c.ink, margin: "0 0 18px" }}>{title}</h2>
      {children}
    </div>
  );
}

/* Icon-box + title/desc + trailing action row — the Figma "Account"
   row shape, reused for Change Password / Active devices / Log out. */
export function ActionRow({ icon, tone, title, desc, action, last }: {
  icon: React.ReactNode; tone?: "danger"; title: string; desc: string; action: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      padding: "16px 0", borderBottom: last ? "none" : `1px solid ${c.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
        <span aria-hidden="true" style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: tone === "danger" ? t.error100 : c.creamSoft,
          border: `1px solid ${tone === "danger" ? t.errorLine : c.border}`,
          color: tone === "danger" ? c.ember : c.inkSoft,
        }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: tone === "danger" ? c.ember : c.ink }}>{title}</div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}

export const flatRowBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ink,
  background: c.creamSoft, border: `1px solid ${c.border}`, borderRadius: 8,
  padding: "9px 14px", cursor: "pointer", minHeight: 36,
};

export function KeyValue({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ink }}>{label}</div>
        <div style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft, marginTop: 2 }}>{value}</div>
      </div>
      <div>{right}</div>
    </div>
  );
}

function TinyChip({ children, tone }: { children: React.ReactNode; tone?: "success" | "warn" }) {
  const palette =
    tone === "success" ? { bg: c.success100, fg: c.sage } :
    tone === "warn" ? { bg: c.warning100, fg: c.warningInk } :
    { bg: c.indigo100, fg: c.indigo };
  return (
    <span style={{
      fontFamily: font.mono, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "4px 8px", borderRadius: 4, background: palette.bg, color: palette.fg, fontWeight: 700,
    }}>{children}</span>
  );
}

export function SoundsSection() {
  const enabled = useUiSoundsEnabled();
  return (
    <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, padding: "0 20px" }}>
      <ActionRow
        last
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>}
        title="Message & notification sounds"
        desc="Play a short sound when you send or receive a message, or get a new notification."
        action={
          <Switch
            checked={enabled}
            onCheckedChange={setUiSoundsEnabled}
            aria-label="Message and notification sounds"
          />
        }
      />
    </div>
  );
}

export const AccountSection = memo(function AccountSection(props: AccountSectionProps) {
  const {
    resetLoading, resetSent, handlePasswordReset, isOAuthOnly,
  } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* ── Security + devices + logout — Figma's "Account" row group ── */}
      <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, padding: "0 20px" }}>
        {!isOAuthOnly ? (
          <ActionRow
            last
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
            title="Change Password"
            desc="Send a reset link to your email when you need to change it."
            action={
              <Button type="button" variant="outline" size="sm" onClick={handlePasswordReset} disabled={resetLoading || resetSent}
                style={{
                  ...flatRowBtn,
                  color: resetSent ? c.sage : c.ink,
                  background: resetSent ? c.success100 : c.creamSoft,
                  cursor: (resetLoading || resetSent) ? "default" : "pointer",
                  opacity: resetLoading ? 0.6 : 1,
                }}
              >
                {resetLoading ? "Sending..." : resetSent ? "Email sent" : "Send Reset Link"}
              </Button>
            }
          />
        ) : (
          <ActionRow
            last
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
            title="Password"
            desc="You signed in with Google — manage your password in your Google Account."
            action={<TinyChip>Google</TinyChip>}
          />
        )}
      </div>
    </div>
  );
});


/* ═══════════════════════════════════════════════════════════════
   PORTFOLIO LINKS SECTION
   ═══════════════════════════════════════════════════════════════ */

const MAX_PORTFOLIO_LINKS = 5;

export interface PortfolioLinksSectionProps {
  portfolioLinks: Array<{ title: string; url: string }> | undefined;
  authUpdateUser: (updates: Record<string, unknown>) => void | Promise<void>;
  showToast: (msg: string) => void;
}

/* What employers see as "proof of work" traces back only to what's saved
 * here — never anything synthesized. One title + one URL per row, capped
 * so the profile doesn't turn into a link farm (mirrors
 * server-handlers/update-profile.ts's MAX_PORTFOLIO_LINKS). */
export const PortfolioLinksSection = memo(function PortfolioLinksSection(props: PortfolioLinksSectionProps) {
  const { portfolioLinks, authUpdateUser, showToast } = props;

  const [links, setLinks] = useState<Array<{ title: string; url: string }>>(() => portfolioLinks ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const atCap = links.length >= MAX_PORTFOLIO_LINKS;

  async function handleAdd() {
    const title = draftTitle.trim();
    const url = draftUrl.trim();
    if (!title) { setFormError("Add a title for this link."); return; }
    if (!/^https?:\/\//i.test(url)) { setFormError("Enter a full URL starting with https://"); return; }

    const next = [...links, { title, url }];
    setAdding(true);
    try {
      await authUpdateUser({ portfolioLinks: next });
      setLinks(next);
      setDialogOpen(false);
      showToast("Link added");
    } catch {
      setFormError("Failed to save — try again");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(i: number) {
    const next = links.filter((_, idx) => idx !== i);
    setRemovingIndex(i);
    try {
      await authUpdateUser({ portfolioLinks: next });
      setLinks(next);
      showToast("Link removed");
    } catch {
      showToast("Failed to remove — try again");
    } finally {
      setRemovingIndex(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={subHeaderHint}>
        Add links to work employers can review — GitHub, Behance, Notion, a personal site.
        Only what you add here is ever shown; nothing is invented on your behalf.
      </p>

      {links.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map((link, i) => (
            <div key={`${link.url}-${i}`} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${c.border}`, background: c.graphite,
            }}>
              <span aria-hidden="true" style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: c.creamSoft, border: `1px solid ${c.border}`, color: c.ink,
              }}>
                <PortfolioLinkIcon url={link.url} size={16} />
              </span>
              <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ minWidth: 0, flex: 1, textDecoration: "none" }}>
                <div style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {link.title}
                </div>
                <div style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {formatPortfolioUrl(link.url)}
                </div>
              </a>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                disabled={removingIndex === i}
                aria-label={`Remove ${link.title}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: "transparent", border: "none", color: c.inkSoft, cursor: "pointer",
                  opacity: removingIndex === i ? 0.5 : 1,
                }}
              >
                <XIcon aria-hidden="true" width={15} height={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (open) { setDraftTitle(""); setDraftUrl(""); setFormError(""); }
        }}
      >
        <DialogTrigger asChild>
          {links.length === 0 ? (
            <button type="button" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: c.inkSoft,
              background: "transparent", border: `1.5px dashed ${c.borderStrong}`, borderRadius: 8,
              padding: "18px 14px", cursor: "pointer", width: "100%",
            }}>
              <PlusIcon aria-hidden="true" width={15} height={15} /> Add your first link
            </button>
          ) : (
            <button type="button" disabled={atCap} style={{
              ...flatRowBtn, display: "inline-flex", alignItems: "center", gap: 6,
              alignSelf: "flex-start", opacity: atCap ? 0.5 : 1,
            }}>
              <PlusIcon aria-hidden="true" width={14} height={14} /> Add link
            </button>
          )}
        </DialogTrigger>
        <DialogContent
          style={{
            display: "block", background: c.graphite, border: `1px solid ${c.border}`,
            borderRadius: 16, padding: "24px 22px", maxWidth: 420, width: "100%",
          }}
        >
          <DialogTitle style={{ fontFamily: font.ui, fontSize: 16, fontWeight: 700, color: c.ink, margin: "0 0 4px" }}>
            Add a portfolio link
          </DialogTitle>
          <DialogDescription style={{ fontFamily: font.ui, fontSize: 12.5, color: c.inkSoft, margin: "0 0 18px" }}>
            GitHub, Dribbble, LinkedIn, Behance, Notion, or any URL.
          </DialogDescription>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => { setDraftTitle(e.target.value); setFormError(""); }}
              placeholder="Title (e.g. GitHub)"
              maxLength={120}
              aria-label="Link title"
              style={{
                fontFamily: font.ui, fontSize: "clamp(13px, calc(13px + (768px - 100vw) * 1000), 16px)", color: c.ink, background: c.cream,
                border: `1px solid ${c.borderStrong}`, borderRadius: 9, padding: "10px 14px",
                outline: "none", minHeight: 40, boxSizing: "border-box",
              }}
            />
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => { setDraftUrl(e.target.value); setFormError(""); }}
              placeholder="https://..."
              maxLength={500}
              aria-label="Link URL"
              style={{
                fontFamily: font.ui, fontSize: "clamp(13px, calc(13px + (768px - 100vw) * 1000), 16px)", color: c.ink, background: c.cream,
                border: `1px solid ${c.borderStrong}`, borderRadius: 9, padding: "10px 14px",
                outline: "none", minHeight: 40, boxSizing: "border-box",
              }}
            />
            {formError && (
              <div style={{ fontFamily: font.ui, fontSize: 12, color: c.ember }}>{formError}</div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <DialogClose asChild>
              <button type="button" style={accSubtleBtnGhost}>Cancel</button>
            </DialogClose>
            <Button type="button" variant="default" size="sm" onClick={handleAdd} disabled={adding}
              style={{ ...indigoPrimaryBtn, opacity: adding ? 0.6 : 1 }}>
              {adding ? "Adding..." : "Add link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {links.length > 0 && (
        <span style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft }}>
          {links.length} / {MAX_PORTFOLIO_LINKS} links{atCap ? " · limit reached" : ""}
        </span>
      )}
    </div>
  );
});


/* ─── Usage this month ─── */
interface UsageRow { count: number; cap: number | null }
interface UsageResponse {
  ok: true;
  tier: string;
  period_start: string;
  period_end: string;
  mock: UsageRow;
  resume_parses: UsageRow;
  coach_insights: null;
}

/* Sentence-case pill with a leading dot — matches the plan-status card's
   Figma spec, distinct from the uppercase-mono TinyChip used elsewhere. */
function PlanStatusChip({ label, tone }: { label: string; tone: "success" | "warn" | "danger" }) {
  const palette =
    tone === "danger" ? { bg: c.error100, fg: c.ember } :
    tone === "warn" ? { bg: c.warning100, fg: c.warningInk } :
    { bg: c.success100, fg: c.sage };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: palette.fg,
      background: palette.bg, borderRadius: 999, padding: "4px 10px",
    }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: palette.fg }} />
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLAN & BILLING SECTION
   ═══════════════════════════════════════════════════════════════ */

interface PlanAuthUser {
  email?: string;
  subscriptionTier?: string;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionPaused?: boolean;
  hasRecurringSubscription?: boolean;
  id?: string;
  signedInVia?: "google" | "email";
}

export interface PlanUsageSectionProps {
  authUser: PlanAuthUser | null;
  tierLabel: string;
  confirmCancel: boolean;
  setConfirmCancel: (v: boolean) => void;
  cancelLoading: boolean;
  setCancelLoading: (v: boolean) => void;
  cancelMsg: string;
  setCancelMsg: (v: string) => void;
  authUpdateUser: (updates: Record<string, unknown>) => void;
  showToast: (msg: string) => void;
  setShowUpgradeModal: (v: boolean) => void;
  authHeaders: () => Promise<Record<string, string>>;
  payments: PaymentRecord[];
  paymentsLoading: boolean;
}

export interface DangerZoneSectionProps {
  authUser: PlanAuthUser | null;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleteEmailInput: string;
  setDeleteEmailInput: (v: string) => void;
  deleteLoading: boolean;
  setDeleteLoading: (v: boolean) => void;
  deleteMsg: string;
  setDeleteMsg: (v: string) => void;
  onLogout: () => void;
  showToast: (msg: string) => void;
  authHeaders: () => Promise<Record<string, string>>;
}

const subHeaderHint: React.CSSProperties = { fontFamily: font.ui, fontSize: 12, color: c.inkSoft, marginTop: 4, lineHeight: 1.5 };
const keyValueLabel: React.CSSProperties = { fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ink };
const keyValueValue: React.CSSProperties = { fontFamily: font.ui, fontSize: 12, color: c.inkSoft, lineHeight: 1.5, marginTop: 2 };


/** Shared by every Plan/Danger-zone mutation: resolve auth headers with a
 * 5s timeout, then run `fn` with an AbortSignal that aborts at 15s. */
async function withAuthedAbort<T>(
  getAuthHeaders: () => Promise<Record<string, string>>,
  fn: (hdrs: Record<string, string>, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const hdrs = await Promise.race([
    getAuthHeaders(),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Auth timeout")), 5000)),
  ]);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fn(hdrs, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

function invoiceDetails(payment: PaymentRecord) {
  const d = new Date(payment.created_at);
  const dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const amountDisplay = `₹${Math.round(payment.amount / 100)}`;
  const paid = payment.status === "completed";
  const tone = paid
    ? { label: "Paid", bg: c.success100, fg: c.sage, border: t.successLine }
    : { label: payment.status, bg: c.error100, fg: c.ember, border: t.errorLine };

  // Derive a human-readable purchase title from plan + amount.
  // payment.plan: "single" | "weekly" (older rows may still say "monthly" — plan discontinued)
  // payment.tier: "free" | "starter" | "team" (unreliable for single — always "free")
  const isSingle = payment.plan === "single";
  const isWeekly = payment.plan === "weekly";
  // Single-session: ₹9 each (900 paise). Derive qty from total amount.
  const sessionQty = isSingle ? Math.round(payment.amount / 900) : 0;

  const purchaseTitle = isSingle
    ? `${sessionQty} extra session${sessionQty !== 1 ? "s" : ""}`
    : isWeekly ? "Interview Sprint Pack"
    : payment.tier
      ? payment.tier.charAt(0).toUpperCase() + payment.tier.slice(1) + " Plan"
      : payment.plan;

  // Sub-line: period for subscriptions, credit note for single purchases.
  let subLine = "";
  if (isSingle) {
    subLine = "Added to session credits · never expire";
  } else if (payment.subscription_start && payment.subscription_end) {
    const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    subLine = `${fmt(payment.subscription_start)} – ${fmt(payment.subscription_end)}`;
  }

  return { dateLabel, amountDisplay, tone, purchaseTitle, subLine };
}

/* ═══════════════════════════════════════════════════════════════
   PLAN & USAGE SECTION
   ═══════════════════════════════════════════════════════════════ */

export const PlanUsageSection = memo(function PlanUsageSection(props: PlanUsageSectionProps) {
  const {
    authUser, tierLabel,
    confirmCancel, setConfirmCancel, cancelLoading, setCancelLoading, cancelMsg, setCancelMsg,
    authUpdateUser, showToast, setShowUpgradeModal,
    authHeaders: getAuthHeaders,
    payments, paymentsLoading,
  } = props;

  const tier = authUser?.subscriptionTier || "free";
  const isPaid = tier !== "free";
  const { creditBalance } = useDashboardSubscription();

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/usage-this-month", { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as UsageResponse;
        if (!cancelled) setUsage(json);
      } catch {
        // Fail quiet — usage is decorative, not gating.
      }
    })();
    return () => { cancelled = true; };
  }, [getAuthHeaders]);

  const sessionsCap = usage?.mock.cap ?? null;
  const sessionsUsed = usage?.mock.count ?? 0;
  const sessionsPct = sessionsCap && sessionsCap > 0 ? Math.min(100, Math.round((sessionsUsed / sessionsCap) * 100)) : 0;
  const capLine = sessionsCap == null
    ? "Unlimited interview sessions"
    : `${sessionsCap} Interview Session${sessionsCap === 1 ? "" : "s"}${authUser?.hasRecurringSubscription ? " / Month" : ""}`;
  const sessionsUsedLabel = sessionsCap == null ? `${sessionsUsed} sessions used` : `${Math.min(sessionsUsed, sessionsCap)} of ${sessionsCap} sessions used`;

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(payments.length / rowsPerPage));
  const page_ = Math.min(page, totalPages);
  const pageRows = payments.slice((page_ - 1) * rowsPerPage, page_ * rowsPerPage);

  let endDateLabel = "";
  let daysLeft = 0;
  if (isPaid && authUser?.subscriptionStart && authUser?.subscriptionEnd) {
    const end = new Date(authUser.subscriptionEnd).getTime();
    daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
    endDateLabel = new Date(authUser.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  const statusLabel = !isPaid ? "Free" : authUser?.cancelAtPeriodEnd ? "Cancelling" : authUser?.subscriptionPaused ? "Paused" : "Active";
  const statusTone: "success" | "warn" | "danger" = authUser?.cancelAtPeriodEnd ? "danger" : authUser?.subscriptionPaused ? "warn" : "success";
  const cycleLabel = isPaid && endDateLabel
    ? (authUser?.cancelAtPeriodEnd
        ? `Access remains until ${endDateLabel}`
        : !authUser?.hasRecurringSubscription
          ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in this pack`
          : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in this cycle`)
    : "Resets at the start of each month";

  async function handleReactivate() {
    setCancelLoading(true); setCancelMsg("");
    try {
      const res = await withAuthedAbort(getAuthHeaders, (hdrs, signal) =>
        fetch("/api/reactivate-subscription", { method: "POST", headers: hdrs, signal }));
      if (res.ok) {
        const data = await res.json();
        if (data.success) { authUpdateUser({ cancelAtPeriodEnd: false }); showToast("Plan reactivated"); }
        else showToast(data.error || "Failed");
      } else {
        const d = await res.json().catch(() => ({})); showToast(d.error || `Failed (${res.status})`);
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "AbortError" ? "Request timed out." : (err instanceof Error ? err.message : "Network error.");
      setCancelMsg(msg); showToast(msg);
    } finally { setCancelLoading(false); }
  }

  async function handlePauseToggle() {
    setCancelLoading(true);
    try {
      const isPaused = !!authUser?.subscriptionPaused;
      const action = isPaused ? "resume" : "pause";
      const res = await withAuthedAbort(getAuthHeaders, (hdrs, signal) =>
        fetch("/api/pause-subscription", { method: "POST", headers: hdrs, body: JSON.stringify({ action }), signal }));
      if (res.ok) {
        const data = await res.json();
        if (data.success) { authUpdateUser({ subscriptionPaused: action === "pause" }); showToast(action === "pause" ? "Subscription paused" : "Subscription resumed"); }
        else showToast(data.error || "Failed");
      } else {
        const d = await res.json().catch(() => ({})); showToast(d.error || "Failed");
      }
    } catch (err) {
      showToast(err instanceof DOMException && err.name === "AbortError" ? "Request timed out." : "Network error.");
    } finally { setCancelLoading(false); }
  }

  async function handleConfirmCancel() {
    setCancelLoading(true); setCancelMsg("");
    try {
      const res = await withAuthedAbort(getAuthHeaders, (hdrs, signal) =>
        fetch("/api/cancel-subscription", { method: "POST", headers: hdrs, signal }));
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          authUpdateUser({ cancelAtPeriodEnd: true });
          setConfirmCancel(false);
          showToast("Plan will cancel at end of period");
          track("subscription_cancelled", { tier: authUser?.subscriptionTier || "unknown" });
        } else { setCancelMsg(data.error || "Failed."); showToast(data.error || "Cancellation failed"); }
      } else {
        const d = await res.json().catch(() => ({})); setCancelMsg(d.error || `Error (${res.status}).`); showToast(d.error || "Cancellation failed");
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "AbortError" ? "Request timed out." : "Network error.";
      setCancelMsg(msg); showToast(msg);
    } finally { setCancelLoading(false); }
  }


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Plan status + usage, and extra-session credits — one card, two
          panels, since both describe the same subscription. */}
      <div style={{ display: "flex", flexWrap: "wrap", border: `1px solid ${c.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0, background: c.graphite, padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: font.ui, fontSize: 22, fontWeight: 700, color: c.ink }}>{tierLabel}</span>
            <PlanStatusChip label={statusLabel} tone={statusTone} />
          </div>
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.inkSoft, marginBottom: 18 }}>{capLine}</div>
          <div style={{ height: 8, borderRadius: 999, background: c.border, overflow: "hidden" }}>
            <div style={{ width: sessionsCap == null ? "100%" : `${sessionsPct}%`, height: "100%", background: c.ink, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft }}>{cycleLabel}</span>
            <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ink }}>{sessionsUsedLabel}</span>
          </div>
          {usage && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.border}`,
              fontFamily: font.ui, fontSize: 12, color: c.inkSoft,
            }}>
              <span>Resume parses this period</span>
              <span style={{ fontWeight: 600, color: c.ink }}>
                {usage.resume_parses.cap == null ? usage.resume_parses.count : `${Math.min(usage.resume_parses.count, usage.resume_parses.cap)} of ${usage.resume_parses.cap}`}
              </span>
            </div>
          )}
        </div>

        <div style={{
          flex: "0 1 300px", minWidth: 240, background: c.creamSoft, borderLeft: `1px solid ${c.border}`,
          padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10,
        }}>
          <div style={{ fontFamily: font.ui, fontSize: 17, fontWeight: 700, color: c.ink }}>{creditBalance} Extra Session{creditBalance === 1 ? "" : "s"}</div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft }}>Available anytime · Never expire</div>
          <div style={{ marginTop: 8 }}>
            {!isPaid ? (
              <Button type="button" variant="default" size="sm" onClick={() => setShowUpgradeModal(true)} style={indigoPrimaryBtn}>
                Upgrade plan
              </Button>
            ) : !authUser?.hasRecurringSubscription ? (
              <Button type="button" variant="default" size="sm" onClick={() => setShowUpgradeModal(true)} style={indigoPrimaryBtn}>
                Renew Plan
              </Button>
            ) : authUser?.cancelAtPeriodEnd ? (
              <Button type="button" variant="outline" size="sm" disabled={cancelLoading} onClick={handleReactivate}
                style={{ ...successSubtleBtn, opacity: cancelLoading ? 0.6 : 1 }}>
                {cancelLoading ? "Reactivating..." : "Reactivate"}
              </Button>
            ) : !confirmCancel ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" variant="outline" size="sm" onClick={handlePauseToggle} style={accSubtleBtn} disabled={cancelLoading}>
                  {authUser?.subscriptionPaused ? "Resume" : "Pause"}
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmCancel(true)} style={dangerSubtleBtn}>Cancel</Button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmCancel(false)} style={accSubtleBtn}>Keep plan</Button>
                <Button type="button" variant="destructive" size="sm" disabled={cancelLoading} onClick={handleConfirmCancel} style={{ ...dangerSolidBtn, opacity: cancelLoading ? 0.6 : 1 }}>
                  {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {cancelMsg && <p style={{ fontFamily: font.ui, fontSize: 12, color: c.ember, margin: 0 }}>{cancelMsg}</p>}

      {/* Payment history — same plan the usage above belongs to, so it
          lives in one section rather than a separate "Billing" block. */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: font.ui, fontSize: 16, fontWeight: 600, color: c.ink }}>Payment history</div>
        </div>
        {paymentsLoading ? (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", gap: 24 }}>
                <div className="skeleton" style={{ height: 12, width: "30%" }} />
                <div className="skeleton" style={{ height: 12, width: "20%" }} />
                <div className="skeleton" style={{ height: 12, width: "15%" }} />
                <div className="skeleton" style={{ height: 12, width: "15%" }} />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.inkSoft, padding: "16px 0" }}>No payments yet.</div>
        ) : (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ background: c.rowTint }}>
                  <TableHead style={{ padding: "0 20px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.inkSoft }}>Description</TableHead>
                  <TableHead style={{ padding: "0 20px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.inkSoft }}>Transaction Date</TableHead>
                  <TableHead style={{ padding: "0 20px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.inkSoft }}>Amount</TableHead>
                  <TableHead style={{ padding: "0 20px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.inkSoft }}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((p) => {
                  const { dateLabel, amountDisplay, tone, purchaseTitle, subLine } = invoiceDetails(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell style={{ padding: "12px 20px" }}>
                        <div style={{ fontFamily: font.ui, fontSize: 13, color: c.ink, fontWeight: 500 }}>{purchaseTitle}</div>
                        {subLine && <div style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft, marginTop: 2 }}>{subLine}</div>}
                      </TableCell>
                      <TableCell style={{ padding: "12px 20px", fontFamily: font.ui, fontSize: 13, color: c.ink, whiteSpace: "nowrap" }}>{dateLabel}</TableCell>
                      <TableCell style={{ padding: "12px 20px", fontFamily: font.mono, fontSize: 13, fontWeight: 600, color: c.ink }}>{amountDisplay}</TableCell>
                      <TableCell style={{ padding: "12px 20px" }}>
                        <div style={{
                          fontFamily: font.ui, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`,
                          borderRadius: 6, padding: "4px 8px", display: "inline-block",
                        }}>{tone.label}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePaginationFooter
              entityLabel="transaction"
              totalCount={payments.length}
              filteredCount={payments.length}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(1); }}
              page={page_}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DANGER ZONE SECTION
   ═══════════════════════════════════════════════════════════════ */

export const DangerZoneSection = memo(function DangerZoneSection(props: DangerZoneSectionProps) {
  const {
    authUser, confirmDelete, setConfirmDelete,
    deleteEmailInput, setDeleteEmailInput, deleteLoading, setDeleteLoading, deleteMsg, setDeleteMsg,
    onLogout, showToast, authHeaders: getAuthHeaders,
  } = props;

  const isOAuthOnlyUser = authUser?.signedInVia === "google";
  const [deletePasswordInput, setDeletePasswordInput] = useState("");

  async function handleConfirmDelete() {
    setDeleteLoading(true); setDeleteMsg("");
    try {
      // Re-auth gate: send the user's password so the server can verify
      // possession-of-credentials, not just possession-of-bearer.
      // OAuth-only users have no app password — server skips the check
      // for them; sending an empty string is fine (server only verifies
      // when present and non-empty for non-OAuth users).
      const body = isOAuthOnlyUser ? {} : { password: deletePasswordInput };
      const res = await withAuthedAbort(getAuthHeaders, (hdrs, signal) =>
        fetch("/api/delete-account", { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify(body), signal }));
      if (res.ok || res.status === 207) {
        const data = await res.json().catch(() => ({}));
        if (data.scheduled) showToast("Account scheduled for deletion. Log in within 7 days to cancel.");
        localStorage.clear();
        onLogout();
      } else {
        const d = await res.json().catch(() => ({}));
        // On failed re-auth, clear the password input so the user retypes
        // rather than re-submitting the same wrong value.
        if (d?.code === "reauth_required" || d?.code === "reauth_failed") setDeletePasswordInput("");
        setDeleteMsg(d.error || "Failed. Try again."); setDeleteLoading(false);
      }
    } catch (err) {
      setDeleteMsg(err instanceof DOMException && err.name === "AbortError" ? "Timed out. Try again." : "Network error.");
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{
      background: t.error100, border: `1px solid ${t.errorLine}`, borderRadius: 12, padding: "20px 24px",
    }}>
      {!confirmDelete ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: c.ember, marginBottom: 2 }}>Delete account</div>
            <div style={subHeaderHint}>Removes your account and all data. A 7-day grace period lets you cancel by logging in.</div>
          </div>
          <Button type="button" variant="destructive" size="sm"
            onClick={() => { setConfirmDelete(true); setDeleteEmailInput(""); setDeletePasswordInput(""); setDeleteMsg(""); }}
            style={{ ...dangerSubtleBtn, flexShrink: 0 }}>
            Begin deletion
          </Button>
        </div>
      ) : (() => {
        const emailMatches = deleteEmailInput.toLowerCase() === (authUser?.email || "").toLowerCase();
        // OAuth users skip the password gate (no app password exists).
        // For everyone else, require a non-empty password before enabling submit.
        const passwordOk = isOAuthOnlyUser || deletePasswordInput.length > 0;
        const submitDisabled = deleteLoading || !emailMatches || !passwordOk;
        return (
        <div>
          <div style={{ ...keyValueLabel, color: c.ember, marginBottom: 6 }}>Confirm deletion</div>
          <div style={keyValueValue}>
            Type your email ({authUser?.email})
            {isOAuthOnlyUser ? " to confirm" : " and re-enter your password to confirm"}.
            Reversible for 7 days after submit.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input type="email" value={deleteEmailInput}
              onChange={(e) => setDeleteEmailInput(e.target.value)}
              aria-label="Confirm email for account deletion"
              autoComplete="off"
              style={{
                fontFamily: font.ui, fontSize: "clamp(13px, calc(13px + (768px - 100vw) * 1000), 16px)", color: c.ink, background: c.graphite,
                border: `1px solid ${t.errorLine}`, borderRadius: 9, padding: "10px 14px",
                outline: "none", minWidth: 0, width: "100%", minHeight: 40, boxSizing: "border-box",
              }} />
            {!isOAuthOnlyUser && (
              <input type="password" value={deletePasswordInput}
                onChange={(e) => setDeletePasswordInput(e.target.value)}
                aria-label="Re-enter password to confirm account deletion"
                placeholder="Re-enter your password"
                autoComplete="current-password"
                style={{
                  fontFamily: font.ui, fontSize: "clamp(13px, calc(13px + (768px - 100vw) * 1000), 16px)", color: c.ink, background: c.graphite,
                  border: `1px solid ${t.errorLine}`, borderRadius: 9, padding: "10px 14px",
                  outline: "none", minWidth: 0, width: "100%", minHeight: 40, boxSizing: "border-box",
                }} />
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
              <Button type="button" variant="outline" size="sm" onClick={() => { setConfirmDelete(false); setDeleteEmailInput(""); setDeletePasswordInput(""); }} style={accSubtleBtn}>Keep account</Button>
              <Button type="button" variant="destructive" size="sm"
                disabled={submitDisabled}
                onClick={handleConfirmDelete}
                style={{ ...dangerSolidBtn, opacity: submitDisabled ? 0.45 : 1 }}>
                {deleteLoading ? "Deleting…" : "Confirm delete"}
              </Button>
            </div>
          </div>
          {deleteMsg && <p style={{ fontFamily: font.ui, fontSize: 12, color: c.ember, marginTop: 10, marginBottom: 0 }}>{deleteMsg}</p>}
        </div>
        );
      })()}
    </div>
  );
});


