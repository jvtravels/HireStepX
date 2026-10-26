"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, PrimaryCta, type BadgeTone } from "@/employer/_atoms";
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

export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <span className="sr-only">{label}…</span>
      <Skeleton style={{ height: 40, width: "min(420px, 70%)", borderRadius: 8 }} />
      <Skeleton style={{ height: 18, width: "min(560px, 90%)", borderRadius: 6 }} />
      <Skeleton style={{ height: 140, width: "100%", borderRadius: 12 }} />
    </div>
  );
}

export function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{ width: "100%", maxWidth: 560, margin: "0 auto", boxSizing: "border-box", padding: 24, textAlign: "center", background: t.white, border: `1px solid ${t.line}`, borderRadius: 12 }}
    >
      <h2 style={{ fontFamily: f.sans, fontSize: 18, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ ...muted, fontSize: 14, margin: "0 0 16px" }}>{message}</p>
      <PrimaryCta onClick={onRetry}>Try again</PrimaryCta>
    </div>
  );
}
