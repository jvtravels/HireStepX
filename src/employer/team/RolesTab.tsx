"use client";

import { CheckIcon, MinusIcon } from "lucide-react";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { can, ROLE_BLURB, ROLE_LABEL, type EmployerRole } from "../../../server-handlers/_employer-team-helpers";
import type { TeamMember } from "../useTeam";
import { PAD, RoleBadge, muted } from "./TeamParts";

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

const sectionTitle: React.CSSProperties = { fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0 };

export default function RolesTab({ myRole, members }: { myRole: EmployerRole; members: TeamMember[] }) {
  const counts = new Map<EmployerRole, number>(ROLES.map((r) => [r, members.filter((m) => m.role === r).length]));

  return (
    <div>
      <section aria-labelledby="roles-who" className={PAD} style={{ paddingBlock: 20 }}>
        <h2 id="roles-who" style={sectionTitle}>Roles</h2>
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
          {ROLES.map((r, i) => {
            const n = counts.get(r) ?? 0;
            return (
              <li
                key={r}
                style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr) auto", alignItems: "center", gap: 16, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}
              >
                <span><RoleBadge role={r} /></span>
                <span style={{ ...muted, fontSize: 13, color: t.coal }}>{ROLE_BLURB[r]}</span>
                <span style={{ ...muted, fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {r === myRole ? (n > 1 ? `You and ${n - 1} more` : "You") : n === 0 ? "No one" : `${n} ${n === 1 ? "person" : "people"}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="roles-can" className={PAD} style={{ paddingBottom: 24, borderTop: `1px solid ${t.line}`, paddingTop: 20, overflowX: "auto" }}>
        <h2 id="roles-can" style={sectionTitle}>What each role can do</h2>
        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontFamily: f.sans, marginTop: 8 }}>
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
                {ROLES.map((r) => (
                  <td key={r} style={{ textAlign: "center", padding: "10px 0" }}>
                    {row.allowed(r) ? (
                      <CheckIcon size={16} aria-label="Allowed" style={{ color: t.successInk, display: "inline-block" }} />
                    ) : (
                      <MinusIcon size={16} aria-label="Not allowed" style={{ color: t.inkFaintWeak, display: "inline-block" }} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
