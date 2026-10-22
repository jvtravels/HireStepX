"use client";

/* Shared fetch + cache for /api/candidate-hiring-activity, consumed by both
   the dashboard's Employer Interest grid (HiringActivityCard) and the
   "Needs Attention" stat card — splitting the fetch across two components
   would double the network call and the localStorage cache key. */

import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { authHeaders } from "./supabase";
import { captureClientEvent } from "./posthogClient";

export interface HiringMatch {
  id: string;
  roleTitle: string;
  companyName: string;
  unlocked?: boolean;
  employmentType: string | null;
  matchedAt: string;
}

export interface HiringActivity {
  shortlistedCount?: number;
  unlockedCount?: number;
  recent?: HiringMatch[];
}

// Module-level in-flight request cache, keyed by user id — the localStorage
// read above only covers the synchronous initial paint; without this, every
// mounted consumer (HiringActivityCard + the "Needs Attention" stat card)
// fired its own network request on top of each other.
// Entries expire after IN_FLIGHT_TTL_MS so a request that never settles can't
// block every later fetch for that user.
const IN_FLIGHT_TTL_MS = 10_000;
const inFlight = new Map<string, { promise: Promise<HiringActivity | null>; startedAt: number }>();

function fetchHiringActivity(userId: string): Promise<HiringActivity | null> {
  const existing = inFlight.get(userId);
  if (existing && Date.now() - existing.startedAt < IN_FLIGHT_TTL_MS) return existing.promise;
  const startedAt = Date.now();
  const promise = (async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/candidate-hiring-activity", { headers });
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        try { localStorage.setItem(`hirestepx_cache_hiring_activity_teaser_${userId}`, JSON.stringify(json)); } catch { /* expected: localStorage may be unavailable */ }
        return json as HiringActivity;
      }
      if (!res.ok) captureClientEvent("hiring_activity_fetch_error", { reason: `status_${res.status}` });
      return null;
    } catch (err) {
      // stay quiet in the UI — this is a nice-to-have, not core flow — but still
      // report it so a systemic outage doesn't go unnoticed.
      captureClientEvent("hiring_activity_fetch_error", { reason: err instanceof Error ? err.message : "unknown" });
      return null;
    } finally {
      if (inFlight.get(userId)?.startedAt === startedAt) inFlight.delete(userId);
    }
  })();
  inFlight.set(userId, { promise, startedAt });
  return promise;
}

export function resetHiringActivityInFlight(): void {
  inFlight.clear();
}

export function useHiringActivity(): HiringActivity | null {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<HiringActivity | null>(() => {
    if (!authUser?.id) return null;
    try {
      const cached = localStorage.getItem(`hirestepx_cache_hiring_activity_teaser_${authUser.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;
    fetchHiringActivity(authUser.id).then((json) => {
      if (!cancelled && json) setData(json);
    });
    return () => { cancelled = true; };
  }, [authUser?.id]);

  return data;
}
