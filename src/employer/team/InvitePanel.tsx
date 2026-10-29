"use client";

import { useId, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  INVITE_TTL_DAYS, ROLE_BLURB, ROLE_LABEL, isValidEmail, normalizeEmail, type InvitableRole,
} from "../../../server-handlers/_employer-team-helpers";
import type { ActionOutcome, InviteResult, TeamAction } from "../useTeam";

const ORDER: InvitableRole[] = ["admin", "member", "viewer"];

export default function InvitePanel({
  roles, onInvite, onClose, existingEmails,
}: {
  roles: InvitableRole[];
  onInvite: (body: Extract<TeamAction, { action: "invite" }>) => Promise<ActionOutcome<InviteResult>>;
  onClose: () => void;
  existingEmails: Set<string>;
}) {
  const options = ORDER.filter((r) => roles.includes(r));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>(options.includes("member") ? "member" : options[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const groupId = useId();

  const clean = normalizeEmail(email);
  const validationError =
    clean && !isValidEmail(clean) ? "Enter a valid email address." :
    clean && existingEmails.has(clean) ? "That person is already on your team." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clean || validationError || busy) return;
    setBusy(true);
    setError(null);
    const res = await onInvite({ action: "invite", email: clean, role });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setSent(res.data);
    setEmail("");
    setCopied(false);
    emailRef.current?.focus();
  };

  const copy = async () => {
    if (!sent) return;
    try { await navigator.clipboard.writeText(sent.link); setCopied(true); } catch { setError("Couldn't copy. Select the link and copy it manually."); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg" style={{ fontFamily: f.sans }}>
      <DialogHeader>
        <DialogTitle style={{ fontFamily: f.sans, fontSize: 17, fontWeight: 600, color: t.coal }}>Invite a teammate</DialogTitle>
        <DialogDescription style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>They get an email with a link that works for {INVITE_TTL_DAYS} days.</DialogDescription>
      </DialogHeader>

      <form onSubmit={(e) => void submit(e)} noValidate>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <label htmlFor={`${groupId}-email`} className="sr-only">Work email</label>
            <Input
              id={`${groupId}-email`}
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              aria-invalid={!!validationError}
              aria-describedby={`${groupId}-msg`}
              className="h-10 bg-white text-base"
              style={{ fontFamily: f.sans }}
            />
          </div>
          <Button type="submit" size="lg" className="h-10 px-5 max-[520px]:w-full" disabled={!clean || !!validationError || busy}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
        </div>

        <p id={`${groupId}-msg`} role={validationError || error ? "alert" : undefined} style={{ fontFamily: f.sans, fontSize: 13, color: t.errorInk, margin: validationError || error ? "8px 0 0" : 0, minHeight: 0 }}>
          {validationError || error}
        </p>

        <div style={{ margin: "14px 0 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.inkSoft }}>Role</span>
          <SegmentedControl
            ariaLabel="Role"
            value={role}
            onChange={setRole}
            options={options.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: 0, flex: "1 1 240px", lineHeight: 1.5 }}>{ROLE_BLURB[role]}</p>
        </div>
      </form>

      {sent && (
        <div role="status" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: t.success100, color: t.successInk, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={13} />
          </span>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, flex: "1 1 240px", lineHeight: 1.5 }}>
            {sent.emailed
              ? <>Email sent to <strong>{sent.invite.email}</strong>. It expires in {INVITE_TTL_DAYS} days. If it hasn&apos;t arrived in a few minutes, check spam or share the link.</>
              : <>We couldn&apos;t email <strong>{sent.invite.email}</strong>. Share this link with them directly.</>}
          </p>
          <Button type="button" variant="outline" size="lg" className="h-9 gap-2 px-3.5" onClick={() => void copy()}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
      </DialogContent>
    </Dialog>
  );
}
