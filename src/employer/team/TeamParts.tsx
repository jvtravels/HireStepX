"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge, type BadgeTone } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { ROLE_BLURB, ROLE_LABEL, type EmployerRole, type InvitableRole } from "../../../server-handlers/_employer-team-helpers";

const ROLE_TONE: Record<EmployerRole, BadgeTone> = {
  owner: "copper",
  admin: "brand",
  member: "neutral",
  viewer: "neutral",
};

const AVATAR_TINTS = [
  { bg: t.indigo100, fg: t.indigoDeep },
  { bg: t.success100, fg: t.successInk },
  { bg: t.copper100, fg: t.copperDark },
  { bg: t.creamSoft, fg: t.neutralInk },
  { bg: t.warning100, fg: t.warningInk },
];

export function initialsOf(label: string): string {
  const base = label.includes("@") ? label.split("@")[0] : label;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase() || "?";
}

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function PersonAvatar({ seed, label, size = 36 }: { seed: string; label: string; size?: number }) {
  const tint = tintFor(seed);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: tint.bg, color: tint.fg, fontFamily: f.sans, fontSize: size <= 28 ? 11 : 13, fontWeight: 600,
      }}
    >
      {initialsOf(label)}
    </span>
  );
}

export function RoleBadge({ role }: { role: EmployerRole }) {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>;
}

/* A role you may change shows as a menu so the options and what each one
   allows are one click away; a role you may not change is a plain badge. */
export function RoleMenu({
  role, options, onSelect, disabled, label,
}: {
  role: EmployerRole;
  options: InvitableRole[];
  onSelect: (role: InvitableRole) => void;
  disabled?: boolean;
  label: string;
}) {
  if (options.length === 0) return <RoleBadge role={role} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Change role for ${label}. Currently ${ROLE_LABEL[role]}`}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--btn-primary)]"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 10px", borderRadius: 999,
            border: `1px solid ${t.line}`, background: t.white, color: t.coal, cursor: disabled ? "default" : "pointer",
            fontFamily: f.sans, fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 1,
          }}
        >
          {ROLE_LABEL[role]}
          <ChevronDownIcon size={13} aria-hidden="true" style={{ color: t.inkSoft }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {options.map((r) => (
          <DropdownMenuItem key={r} onClick={() => { if (r !== role) onSelect(r); }} className="items-start gap-3 py-2">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{ROLE_LABEL[r]}</span>
              <span style={{ display: "block", fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{ROLE_BLURB[r]}</span>
            </span>
            {r === role && <CheckIcon size={14} aria-hidden="true" style={{ marginTop: 3, color: t.indigo }} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ConfirmSpec {
  title: string;
  body: string;
  action: string;
  destructive?: boolean;
  run: () => Promise<void> | void;
}

export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec | null; onClose: () => void }) {
  return (
    <AlertDialog open={!!spec} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{spec?.title}</AlertDialogTitle>
          <AlertDialogDescription>{spec?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={spec?.destructive ? "destructive" : "default"}
            onClick={() => { void spec?.run(); }}
          >
            {spec?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const muted: React.CSSProperties = { fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: 0, lineHeight: 1.5 };

export const PAD = "px-4 sm:px-7";

/* Seats are a hard cap, so the meter is quiet until the team is nearly full. */
export function SeatMeter({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
  const nearFull = pct >= 80;
  return (
    <div style={{ minWidth: 132 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
        <span>Seats</span>
        <span style={{ color: nearFull ? t.warningInk : t.coal, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{used} of {max}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Seats used"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={used}
        style={{ height: 4, borderRadius: 999, background: t.creamSoft, marginTop: 6, overflow: "hidden" }}
      >
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: nearFull ? t.warningInk : t.indigo, transition: "width 200ms ease-out" }} />
      </div>
    </div>
  );
}

export function EmptyBlock({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: t.creamSoft, color: t.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
        {icon}
      </span>
      <h2 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>{title}</h2>
      <p style={{ ...muted, maxWidth: 380 }}>{body}</p>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
