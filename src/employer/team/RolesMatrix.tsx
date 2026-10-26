"use client";

import { useId, useState } from "react";
import { CheckIcon, ChevronRightIcon, MinusIcon } from "lucide-react";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { can, ROLE_BLURB, ROLE_LABEL, type EmployerRole } from "../../../server-handlers/_employer-team-helpers";
import { PAD } from "./TeamParts";

const ROLES: EmployerRole[] = ["owner", "admin", "member", "viewer"];

const ROWS: Array<{ label: string; allowed: (role: EmployerRole) => boolean }> = [
  { label: "View jobs and candidates", allowed: (r) => can(r, "jobs.read") && can(r, "candidates.read") },
  { label: "Post and edit jobs", allowed: (r) => can(r, "jobs.write") },
  { label: "Unlock candidates and move them through the pipeline", allowed: (r) => can(r, "candidates.unlock") && can(r, "candidates.manage") },
  { label: "Message candidates", allowed: (r) => can(r, "messages.send") },
  { label: "Edit the company profile", allowed: (r) => can(r, "company.edit") },
  { label: "Invite and manage teammates", allowed: (r) => can(r, "team.invite") && can(r, "team.manage") },
  { label: "See the activity log", allowed: (r) => can(r, "audit.read") },
  { label: "Transfer ownership", allowed: (r) => r === "owner" },
];

export default function RolesMatrix({ myRole, defaultOpen }: { myRole: EmployerRole; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section aria-label="Roles and permissions" style={{ borderTop: `1px solid ${t.line}` }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`${PAD} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--btn-primary)]`}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", paddingBlock: 14, background: "none", border: 0, cursor: "pointer", textAlign: "left" }}
      >
        <ChevronRightIcon
          size={16}
          aria-hidden="true"
          style={{ color: t.inkSoft, transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms ease-out", flexShrink: 0 }}
        />
        <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>Roles and permissions</span>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>What each role can do</span>
      </button>

      {open && (
        <div id={panelId} className={PAD} style={{ paddingBottom: 22, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontFamily: f.sans }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", padding: "0 0 10px", fontSize: 12, fontWeight: 500, color: t.inkSoft }}>
                  <span className="sr-only">Capability</span>
                </th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" style={{ width: 88, textAlign: "center", padding: "0 0 10px", fontSize: 12, fontWeight: 600, color: r === myRole ? t.indigoDeep : t.coal }}>
                    {ROLE_LABEL[r]}
                    {r === myRole && <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: t.inkSoft }}>You</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} style={{ borderTop: `1px solid ${t.line}` }}>
                  <th scope="row" style={{ textAlign: "left", padding: "10px 12px 10px 0", fontSize: 13, fontWeight: 400, color: t.coal }}>{row.label}</th>
                  {ROLES.map((r) => {
                    const yes = row.allowed(r);
                    return (
                      <td key={r} style={{ textAlign: "center", padding: "10px 0" }}>
                        {yes ? (
                          <CheckIcon size={16} aria-label="Allowed" style={{ color: t.successInk, display: "inline-block" }} />
                        ) : (
                          <MinusIcon size={16} aria-label="Not allowed" style={{ color: t.inkFaintWeak, display: "inline-block" }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "12px 0 0", lineHeight: 1.5 }}>{ROLE_BLURB[myRole]}</p>
        </div>
      )}
    </section>
  );
}
