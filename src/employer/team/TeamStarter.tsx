"use client";

import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { ROLE_BLURB, ROLE_LABEL, type InvitableRole } from "../../../server-handlers/_employer-team-helpers";
import { PAD, muted } from "./TeamParts";

const WHO: Record<InvitableRole, string> = {
  admin: "A co-founder or head of hiring",
  member: "Recruiters and hiring managers",
  viewer: "Finance, leadership or an agency partner",
};

/* Shown under the member list while you are the only person on the team, so the page says what a
   team is for and gives one obvious next step instead of a blank half screen. */
export default function TeamStarter({ roles, seatsLeft, onInvite }: { roles: InvitableRole[]; seatsLeft: number; onInvite: () => void }) {
  const shown = (["member", "admin", "viewer"] as const).filter((r) => roles.includes(r));
  return (
    <section aria-labelledby="team-starter-title" className={PAD} style={{ borderTop: `1px solid ${t.line}`, paddingTop: 28, paddingBottom: 32, background: t.creamRaised }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 520 }}>
          <h2 id="team-starter-title" style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 600, color: t.coal, margin: 0 }}>Hire together</h2>
          <p style={{ ...muted, fontSize: 14, marginTop: 4 }}>
            Add the people who help you hire. They share your jobs, candidates and messages, and you decide what each person can do.
            {seatsLeft > 0 ? ` You have ${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} free.` : ""}
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={onInvite}>
          <UserPlusIcon aria-hidden="true" /> Invite your first teammate
        </Button>
      </div>
      <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, border: `1px solid ${t.line}`, borderRadius: 12, background: t.line, overflow: "hidden" }}>
        {shown.map((r) => (
          <li key={r} style={{ padding: "14px 16px", background: t.white }}>
            <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{ROLE_LABEL[r]}</div>
            <div style={{ ...muted, fontSize: 12, marginTop: 2 }}>{WHO[r]}</div>
            <div style={{ ...muted, fontSize: 12, marginTop: 8 }}>{ROLE_BLURB[r]}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
