"use client";

import { useId, useRef, useState } from "react";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  INVITE_TTL_DAYS, MAX_BULK_INVITES, ROLE_BLURB, ROLE_LABEL, parseEmailList, type InvitableRole,
} from "../../../server-handlers/_employer-team-helpers";
import type { ActionOutcome, InviteResult, TeamAction } from "../useTeam";
import { PAD } from "./TeamParts";

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
  const [raw, setRaw] = useState("");
  const [role, setRole] = useState<InvitableRole>(options.includes("member") ? "member" : options[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InviteResult[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const groupId = useId();

  const { valid, invalid } = parseEmailList(raw);
  const already = valid.filter((e) => existingEmails.has(e));
  const targets = valid.filter((e) => !existingEmails.has(e));
  const validationError =
    invalid.length ? `${invalid[0]} isn't a valid email address.` :
    valid.length > MAX_BULK_INVITES ? `Invite up to ${MAX_BULK_INVITES} people at a time.` :
    valid.length && !targets.length ? (valid.length === 1 ? "That person is already on your team." : "Everyone here is already on your team or invited.") :
    null;
  const note = !validationError && already.length ? `${already.length} already on your team or invited, skipped.` : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targets.length || validationError || busy) return;
    setBusy(true);
    setError(null);
    setSent([]);
    const done: InviteResult[] = [];
    const failed: Array<{ email: string; error: string }> = [];
    for (const email of targets) {
      const res = await onInvite({ action: "invite", email, role });
      if (res.ok) done.push(res.data);
      else {
        failed.push({ email, error: res.error });
        if (/lot of invites|try again/i.test(res.error)) break;
      }
    }
    setBusy(false);
    setSent(done);
    setCopied(null);
    setRaw(failed.map((x) => x.email).join(", "));
    if (failed.length) setError(failed.length === 1 ? `${failed[0].email}: ${failed[0].error}` : `${failed.length} invites didn't go through. ${failed[0].error}`);
    emailRef.current?.focus();
  };

  const copy = async (inv: InviteResult) => {
    try { await navigator.clipboard.writeText(inv.link); setCopied(inv.invite.id); } catch { setError("Couldn't copy. Select the link and copy it manually."); }
  };

  const unsent = sent.filter((s) => !s.emailed);
  const emailedCount = sent.length - unsent.length;

  return (
    <section aria-label="Invite a teammate" className={PAD} style={{ background: t.creamRaised, borderBottom: `1px solid ${t.line}`, paddingTop: 18, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>Invite teammates</h2>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "2px 0 0" }}>They get an email with a link that works for {INVITE_TTL_DAYS} days. Paste up to {MAX_BULK_INVITES} addresses, separated by commas or spaces.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close invite form" onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      <form onSubmit={(e) => void submit(e)} noValidate>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <label htmlFor={`${groupId}-email`} className="sr-only">Work email</label>
            <Input
              id={`${groupId}-email`}
              ref={emailRef}
              type="text"
              inputMode="email"
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              placeholder="teammate@company.com"
              value={raw}
              onChange={(e) => { setRaw(e.target.value); if (error) setError(null); }}
              aria-invalid={!!validationError}
              aria-describedby={`${groupId}-msg`}
              className="h-10 bg-white text-base"
              style={{ fontFamily: f.sans }}
            />
          </div>
          <Button type="submit" size="lg" className="h-10 px-5 max-[520px]:w-full" disabled={!targets.length || !!validationError || busy}>
            {busy ? "Sending…" : targets.length > 1 ? `Send ${targets.length} invites` : "Send invite"}
          </Button>
        </div>

        <p id={`${groupId}-msg`} role={validationError || error ? "alert" : undefined} style={{ fontFamily: f.sans, fontSize: 13, color: validationError || error ? t.errorInk : t.inkSoft, margin: validationError || error || note ? "8px 0 0" : 0, minHeight: 0 }}>
          {validationError || error || note}
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

      {sent.length > 0 && (
        <div role="status" style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {emailedCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: t.success100, color: t.successInk, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <CheckIcon size={13} />
              </span>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, lineHeight: 1.5 }}>
                {emailedCount === 1
                  ? <>Invite sent to <strong>{sent.find((s) => s.emailed)?.invite.email}</strong>. It expires in {INVITE_TTL_DAYS} days.</>
                  : <>{emailedCount} invites sent. They expire in {INVITE_TTL_DAYS} days.</>}
              </p>
              {sent.length === 1 && emailedCount === 1 && (
                <Button type="button" variant="outline" size="lg" className="ml-auto h-9 gap-2 px-3.5" onClick={() => void copy(sent[0])}>
                  {copied === sent[0].invite.id ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                  {copied === sent[0].invite.id ? "Copied" : "Copy link"}
                </Button>
              )}
            </div>
          )}
          {unsent.map((s) => (
            <div key={s.invite.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, flex: "1 1 240px", lineHeight: 1.5 }}>
                We couldn&apos;t email <strong>{s.invite.email}</strong>. Share this link with them directly.
              </p>
              <Button type="button" variant="outline" size="lg" className="h-9 gap-2 px-3.5" onClick={() => void copy(s)}>
                {copied === s.invite.id ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                {copied === s.invite.id ? "Copied" : "Copy link"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
