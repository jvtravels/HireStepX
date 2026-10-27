"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/apiClient";
import { authHeaders } from "@/supabase";
import type { EmployerRole, InvitableRole } from "../../server-handlers/_employer-team-helpers";
import type { ActivityEvent, ActivityGroup } from "./teamActivity";

export interface TeamMember {
  userId: string;
  role: EmployerRole;
  email: string;
  name: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  invitedBy: string | null;
  isYou: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: InvitableRole;
  createdAt: string;
  expiresAt: string;
  state: "pending" | "expired" | "revoked" | "accepted";
  invitedByName: string | null;
}

export interface TeamSnapshot {
  me: { userId: string; role: EmployerRole; email: string };
  members: TeamMember[];
  invites: TeamInvite[];
  assignableRoles: InvitableRole[];
  limits: { maxTeamSize: number; invitesPerDay: number; inviteTtlDays: number };
}

export interface ActivitySummary { userId: string; count: number; lastAt: string }

export interface ActivityFilter { actor: string; group: ActivityGroup | "" }

export type TeamAction =
  | { action: "invite"; email: string; role: InvitableRole }
  | { action: "resend_invite"; inviteId: string }
  | { action: "revoke_invite"; inviteId: string }
  | { action: "set_role"; userId: string; role: InvitableRole }
  | { action: "remove_member"; userId: string }
  | { action: "transfer_ownership"; userId: string }
  | { action: "leave" };

export interface InviteResult { invite: TeamInvite; link: string; emailed: boolean }

export type ActionOutcome<T = unknown> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function getJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, { headers: await authHeaders() });
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !body) return { ok: false, error: body?.error || GENERIC_ERROR, status: res.status };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: "Couldn't reach our servers. Check your connection.", status: 0 };
  }
}

export function useTeam() {
  const [team, setTeam] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getJson<TeamSnapshot>("/api/employer-team");
    if (res.ok) { setTeam(res.data); setError(null); } else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async <T,>(body: TeamAction): Promise<ActionOutcome<T>> => {
    const res = await apiFetch<T>("/api/employer-team", body, { method: "POST" });
    if (res.ok && res.data !== null) {
      if (body.action !== "leave") await load();
      return { ok: true, data: res.data };
    }
    const err = res.errorData as { error?: string; code?: string } | null;
    return { ok: false, error: err?.error || res.error || GENERIC_ERROR, code: err?.code };
  }, [load]);

  return { team, loading, error, reload: load, run };
}

export function useTeamActivity(enabled: boolean, filter: ActivityFilter) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [summary, setSummary] = useState<ActivitySummary[]>([]);
  const [summaryDays, setSummaryDays] = useState(30);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const fetchPage = useCallback(async (before: string | null) => {
    const q = new URLSearchParams({ limit: "30" });
    if (filter.actor) q.set("actor", filter.actor);
    if (filter.group) q.set("group", filter.group);
    if (before) q.set("before", before);
    return getJson<{ events: ActivityEvent[]; nextBefore: string | null; summary: ActivitySummary[]; summaryDays: number }>(`/api/employer-team-activity?${q}`);
  }, [filter.actor, filter.group]);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    setLoading(true);
    void fetchPage(null).then((res) => {
      if (mine !== seq.current) return;
      if (res.ok) {
        setEvents(res.data.events); setNextBefore(res.data.nextBefore);
        setSummary(res.data.summary); setSummaryDays(res.data.summaryDays); setError(null);
      } else setError(res.error);
      setLoading(false);
    });
  }, [enabled, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextBefore) return;
    const mine = seq.current;
    setLoading(true);
    const res = await fetchPage(nextBefore);
    if (mine !== seq.current) return;
    if (res.ok) { setEvents((prev) => [...prev, ...res.data.events]); setNextBefore(res.data.nextBefore); } else setError(res.error);
    setLoading(false);
  }, [fetchPage, nextBefore]);

  return { events, summary, summaryDays, nextBefore, loading, error, loadMore };
}
