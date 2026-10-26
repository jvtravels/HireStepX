"use client";

import { Fragment, useMemo } from "react";
import { ActivityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { ActivityFilter, TeamMember } from "../useTeam";
import type { useTeamActivity } from "../useTeam";
import { dayBucket, describeEvent, type ActivityGroup } from "../teamActivity";
import { PersonAvatar, muted } from "./TeamParts";

const GROUPS: Array<{ id: ActivityGroup | ""; label: string }> = [
  { id: "", label: "All" },
  { id: "members", label: "Team" },
  { id: "jobs", label: "Jobs" },
  { id: "candidates", label: "Candidates" },
  { id: "company", label: "Company" },
];

export default function ActivityTab({
  activity, filter, onFilter, members,
}: {
  activity: ReturnType<typeof useTeamActivity>;
  filter: ActivityFilter;
  onFilter: (next: ActivityFilter) => void;
  members: TeamMember[];
}) {
  const { events, loading, error, nextBefore, loadMore } = activity;
  const filtered = !!(filter.actor || filter.group);

  const days = useMemo(() => {
    const out: Array<{ label: string; items: typeof events }> = [];
    for (const e of events) {
      const label = dayBucket(e.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [events]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "14px 28px", borderBottom: `1px solid ${t.line}` }}>
        <div role="group" aria-label="Filter by area" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {GROUPS.map((g) => {
            const on = filter.group === g.id;
            return (
              <button
                key={g.id || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => onFilter({ ...filter, group: g.id })}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--btn-primary)]"
                style={{
                  padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: f.sans, fontSize: 13, fontWeight: 500,
                  border: `1px solid ${on ? t.coal : t.line}`, background: on ? t.coal : t.white, color: on ? t.white : t.neutralInk,
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <label style={{ flex: "1 1 220px", maxWidth: 320, marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
          Member
          <select
            value={filter.actor}
            onChange={(e) => onFilter({ ...filter, actor: e.target.value })}
            style={{ flex: 1, minWidth: 0, fontFamily: f.sans, fontSize: 13, color: t.coal, border: `1px solid ${t.line}`, borderRadius: 8, padding: "6px 28px 6px 10px", background: t.white, height: 32 }}
          >
            <option value="">Everyone</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
          </select>
        </label>
      </div>

      {error && events.length === 0 ? (
        <p role="alert" style={{ ...muted, padding: "40px 28px", textAlign: "center", color: t.errorInk }}>{error}</p>
      ) : events.length === 0 && !loading ? (
        <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: t.creamSoft, color: t.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
            <ActivityIcon size={18} />
          </span>
          <h2 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>{filtered ? "No matching activity" : "No activity yet"}</h2>
          <p style={{ ...muted, maxWidth: 360 }}>
            {filtered ? "Try a different area or member." : "Posting jobs, unlocking candidates and team changes will appear here."}
          </p>
          {filtered && <Button type="button" variant="outline" size="lg" className="mt-3 h-9 px-4" onClick={() => onFilter({ actor: "", group: "" })}>Clear filters</Button>}
        </div>
      ) : (
        <div>
          {days.map((day) => (
            <Fragment key={day.label}>
              <h3 style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.inkSoft, margin: 0, padding: "14px 28px 6px", background: t.creamRaised, borderBottom: `1px solid ${t.line}` }}>{day.label}</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {day.items.map((e, i) => {
                  const d = describeEvent(e);
                  return (
                    <li key={e.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 28px", borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}>
                      <PersonAvatar seed={e.actor.userId ?? "system"} label={e.actor.name} size={28} />
                      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, margin: 0, flex: 1, minWidth: 0, lineHeight: 1.5, paddingTop: 3, overflowWrap: "anywhere" }}>
                        <strong style={{ fontWeight: 600 }}>{e.actor.name}</strong>
                        {e.actor.removed && <span style={{ color: t.inkSoft }}> (removed)</span>}{" "}
                        {d.verb}
                        {d.subject && <> <strong style={{ fontWeight: 600 }}>{d.subject}</strong></>}
                        {d.detail && <span style={{ color: t.inkSoft }}> {d.detail}</span>}
                      </p>
                      <time dateTime={e.at} title={new Date(e.at).toLocaleString("en-IN")} style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, whiteSpace: "nowrap", paddingTop: 5, fontVariantNumeric: "tabular-nums" }}>
                        {new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
          {loading && <p role="status" style={{ ...muted, padding: "16px 28px" }}>Loading…</p>}
          {nextBefore && !loading && (
            <div style={{ padding: "16px 28px", borderTop: `1px solid ${t.line}` }}>
              <Button type="button" variant="outline" size="lg" className="h-9 px-4" onClick={() => void loadMore()}>Load more</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
