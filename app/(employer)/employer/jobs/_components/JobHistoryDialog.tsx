"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import type { RequirementSummary } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { ACTIVITY_LABEL } from "./jobsHelpers";

const note: React.CSSProperties = { padding: "24px 0", textAlign: "center", fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft };

export default function JobHistoryDialog({
  target, items, loading, onClose,
}: {
  target: RequirementSummary | null;
  items: RequirementActivity[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>History{target ? ` · ${target.title}` : ""}</DialogTitle>
          <DialogDescription>Every status change and edit made to this requirement.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div role="status" style={note}>Loading history…</div>
        ) : items && items.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2, maxHeight: 360, overflowY: "auto" }}>
            {items.map((a) => (
              <li key={a.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "10px 2px", borderBottom: `1px solid ${t.line}` }}>
                <span style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 500, color: t.coal }}>{ACTIVITY_LABEL[a.action]}</span>
                <time dateTime={a.createdAt} style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, whiteSpace: "nowrap" }}>{new Date(a.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        ) : (
          <div style={note}>No history recorded yet.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
