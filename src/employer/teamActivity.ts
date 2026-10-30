import { CANDIDATE_STATUS_LABEL, STAGE_LABEL } from "./_atoms";
import { ROLE_LABEL, isEmployerRole } from "../../server-handlers/_employer-team-helpers";
import type { CandidateStatus, RequirementStage } from "./mockData";

export type ActivityGroup = "members" | "jobs" | "candidates" | "company";

export interface ActivityEvent {
  id: string;
  at: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown>;
  actor: { userId: string | null; name: string; removed: boolean };
}

export interface DescribedEvent {
  /** What happened, without the actor: "unlocked Rahul S." */
  verb: string;
  /** The noun the verb acts on, rendered emphasised: a job title or person. */
  subject: string | null;
  /** A trailing qualifier, rendered muted: "for Senior Engineer". */
  detail: string | null;
  group: ActivityGroup;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const roleLabel = (v: unknown): string | null => (isEmployerRole(v) ? ROLE_LABEL[v].toLowerCase() : null);
const label = <T extends string>(map: Record<T, string>, v: unknown): string | null =>
  typeof v === "string" && v in map ? map[v as T] : null;

export function groupOfAction(action: string): ActivityGroup {
  if (action.startsWith("member.")) return "members";
  if (action.startsWith("job.")) return "jobs";
  if (action.startsWith("candidate.")) return "candidates";
  return "company";
}

/* Locked candidates are logged without a name (the server omits it), so the
   sentence falls back to "a candidate" rather than leaking or inventing one. */
export function describeEvent(e: Pick<ActivityEvent, "action" | "meta">): DescribedEvent {
  const m = e.meta;
  const group = groupOfAction(e.action);
  const job = str(m.title) ?? str(m.jobTitle);
  switch (e.action) {
    case "member.invited":
      return { verb: "invited", subject: str(m.email), detail: roleLabel(m.role) && `as ${roleLabel(m.role)}`, group };
    case "member.invite_resent":
      return { verb: "resent the invite to", subject: str(m.email), detail: null, group };
    case "member.invite_revoked":
      return { verb: "revoked the invite for", subject: str(m.email), detail: null, group };
    case "member.joined":
      return { verb: "joined the team", subject: null, detail: roleLabel(m.role) && `as ${roleLabel(m.role)}`, group };
    case "member.role_changed": {
      if (m.transfer) return { verb: "transferred ownership to", subject: str(m.email), detail: null, group };
      const to = roleLabel(m.to);
      return { verb: "changed the role of", subject: str(m.email), detail: to && `to ${to}`, group };
    }
    case "member.removed":
      return { verb: "removed", subject: str(m.email), detail: "from the team", group };
    case "member.left":
      return { verb: m.accountDeleted ? "left the team (account deleted)" : "left the team", subject: null, detail: null, group };
    case "job.created":
      return { verb: "posted", subject: job, detail: null, group };
    case "job.updated":
      return { verb: "edited", subject: job, detail: null, group };
    case "job.archived":
      return { verb: "archived", subject: job, detail: str(m.reason), group };
    case "job.reopened":
      return { verb: "reopened", subject: job, detail: null, group };
    case "job.stage_changed": {
      const stage = label(STAGE_LABEL as Record<RequirementStage, string>, m.stage);
      return { verb: "moved a job", subject: null, detail: stage && `to ${stage}`, group };
    }
    case "job.public_listing_changed":
      return { verb: m.on ? "opted in to listing" : "withdrew from the public listing", subject: job, detail: m.on ? "on the open roles page, pending approval" : null, group };
    case "candidate.unlocked":
      return { verb: "unlocked", subject: str(m.candidateName) ?? "a candidate", detail: null, group };
    case "candidate.status_changed": {
      const to = label(CANDIDATE_STATUS_LABEL as Record<CandidateStatus, string>, m.to);
      const who = str(m.candidateName) ?? "a candidate";
      const jobPart = str(m.jobTitle);
      return {
        verb: "marked",
        subject: who,
        detail: [to && `as ${to}`, jobPart && `for ${jobPart}`].filter(Boolean).join(" ") || null,
        group,
      };
    }
    case "candidate.note_updated": {
      const jobPart = str(m.jobTitle);
      return { verb: "updated notes on", subject: str(m.candidateName) ?? "a candidate", detail: jobPart && `for ${jobPart}`, group };
    }
    case "candidate.messaged": {
      const jobPart = str(m.jobTitle);
      return { verb: "messaged", subject: str(m.candidateName) ?? "a candidate", detail: jobPart && `for ${jobPart}`, group };
    }
    case "company.profile_updated": {
      const changed = Array.isArray(m.changed) ? m.changed.filter((c): c is string => typeof c === "string") : [];
      return { verb: "updated the company profile", subject: null, detail: changed.length ? changed.join(", ") : null, group };
    }
    default:
      return { verb: e.action, subject: null, detail: null, group };
  }
}

export function dayBucket(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const secs = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));
}
