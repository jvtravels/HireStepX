"use client";

import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Card, SkillTag } from "@/employer/_atoms";
import type { Requirement } from "@/employer/EmployerDataContext";
import { roleDetailRows } from "./requirementFormat";

const dtStyle = { fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: 0 } as const;
const ddStyle = { fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal, margin: "2px 0 0", overflowWrap: "anywhere", whiteSpace: "pre-wrap" } as const;

/** Everything the posting form collects that the summary header doesn't show,
 *  so an employer can confirm what they saved without reopening the editor. */
export default function RequirementDetails({ requirement }: { requirement: Requirement }) {
  const rows = roleDetailRows(requirement);
  if (rows.length === 0) return null;
  return (
    <Card aria-labelledby="role-details-heading" style={{ marginTop: 16, boxShadow: "none" }}>
      <h2 id="role-details-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 600, color: t.coal, margin: 0 }}>
        Role details
      </h2>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px", margin: "12px 0 0" }}>
        {rows.map((row) => (
          <div key={row.label} style={{ minWidth: 0, gridColumn: row.wide ? "1 / -1" : undefined }}>
            <dt style={dtStyle}>{row.label}</dt>
            {row.tags ? (
              <dd style={{ ...ddStyle, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {row.tags.map((tag) => <SkillTag key={tag}>{tag}</SkillTag>)}
              </dd>
            ) : (
              <dd style={ddStyle}>{row.text}</dd>
            )}
          </div>
        ))}
      </dl>
    </Card>
  );
}
