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
  employmentType: string | null;
  matchedAt: string;
}

export interface HiringActivity {
  shortlistedCount?: number;
  unlockedCount?: number;
  recent?: HiringMatch[];
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
    const cacheKey = `hirestepx_cache_hiring_activity_teaser_${authUser.id}`;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/candidate-hiring-activity", { headers });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json) {
          setData(json as HiringActivity);
          try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* expected: localStorage may be unavailable */ }
        } else if (!cancelled && !res.ok) {
          captureClientEvent("hiring_activity_fetch_error", { reason: `status_${res.status}` });
        }
      } catch (err) {
        // stay quiet in the UI — this is a nice-to-have, not core flow — but still
        // report it so a systemic outage doesn't go unnoticed.
        captureClientEvent("hiring_activity_fetch_error", { reason: err instanceof Error ? err.message : "unknown" });
      }
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  return data;
}
