"use client";

import { Fragment, useMemo } from "react";
import { ActivityIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge, SegmentedControl } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { ActivityFilter, TeamMember } from "../useTeam";
import type { useTeamActivity } from "../useTeam";
import { activityToCsv, dayBucket, describeEvent, type ActivityGroup } from "../teamActivity";

const GROUP_LABEL: Record<ActivityGroup, string> = { members: "Team", jobs: "Jobs", candidates: "Candidates", company: "Company" };
import { EmptyBlock, PAD, PersonAvatar, muted } from "./TeamParts";

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

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([activityToCsv(events)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className={PAD} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${t.line}` }}>
        <SegmentedControl
          ariaLabel="Filter by area"
          value={filter.group}
          onChange={(group) => onFilter({ ...filter, group })}
          options={GROUPS.map((g) => ({ value: g.id, label: g.label }))}
        />
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
          Member
          <NativeSelect
            value={filter.actor}
            onChange={(e) => onFilter({ ...filter, actor: e.target.value })}
            className="min-w-44"
          >
            <option value="">Everyone</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
          </NativeSelect>
        </label>
        {events.length > 0 && (
          <Button type="button" variant="outline" size="lg" className="h-9 gap-2 px-3.5" onClick={exportCsv}>
            <DownloadIcon aria-hidden="true" /> Export CSV
          </Button>
        )}
      </div>

      {error && events.length === 0 ? (
        <p role="alert" className={PAD} style={{ ...muted, paddingTop: 40, paddingBottom: 40, textAlign: "center", color: t.errorInk }}>{error}</p>
      ) : events.length === 0 && !loading ? (
        <EmptyBlock
          icon={<ActivityIcon size={18} />}
          title={filtered ? "No matching activity" : "No activity yet"}
          body={filtered ? "Try a different area or member." : "Posting jobs, unlocking candidates and team changes will appear here, each with who did it."}
          action={filtered && <Button type="button" variant="outline" size="lg" className="h-9 px-4" onClick={() => onFilter({ actor: "", group: "" })}>Clear filters</Button>}
        />
      ) : (
        <div>
          {days.map((day) => (
            <Fragment key={day.label}>
              <h3 className={PAD} style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.inkSoft, margin: 0, paddingTop: 8, paddingBottom: 8, background: t.creamRaised, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>{day.label}</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {day.items.map((e, i) => {
                  const d = describeEvent(e);
                  return (
                    <li key={e.id} className={PAD} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 12, paddingBottom: 12, borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}>
                      <PersonAvatar seed={e.actor.userId ?? "system"} label={e.actor.name} size={28} />
                      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, margin: 0, flex: 1, minWidth: 0, lineHeight: 1.5, paddingTop: 3, overflowWrap: "anywhere" }}>
                        <strong style={{ fontWeight: 600 }}>{e.actor.name}</strong>
                        {e.actor.removed && <span style={{ color: t.inkSoft }}> (removed)</span>}{" "}
                        {d.verb}
                        {d.subject && <> <strong style={{ fontWeight: 600 }}>{d.subject}</strong></>}
                        {d.detail && <span style={{ color: t.inkSoft }}> {d.detail}</span>}
                      </p>
                      <Badge tone="neutral" className="max-sm:hidden">{GROUP_LABEL[d.group]}</Badge>
                      <time dateTime={e.at} title={new Date(e.at).toLocaleString("en-IN")} style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, whiteSpace: "nowrap", paddingTop: 5, minWidth: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
          {loading && <p role="status" className={PAD} style={{ ...muted, paddingTop: 16, paddingBottom: 16 }}>Loading…</p>}
          {nextBefore && !loading && (
            <div className={PAD} style={{ paddingTop: 16, paddingBottom: 16, borderTop: `1px solid ${t.line}` }}>
              <Button type="button" variant="outline" size="lg" className="h-9 px-4" onClick={() => void loadMore()}>Load more</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
