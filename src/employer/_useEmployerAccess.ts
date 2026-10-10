"use client";

/* Employer trust state for the requirement surfaces: suspended flag, tier and
   per-tier limits from GET /api/employer-profile.

   EmployerDataContext may start exposing these directly; when it does the
   values are read from it (via `in` narrowing, so this file compiles either
   way) and no extra request is made. Until then the hook fetches the profile
   itself. A failed fetch never blocks the UI: the server still enforces every
   limit and answers 403/429, which each surface already shows inline. */

import { useCallback, useEffect, useState } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { getEmployerAccess, type EmployerProfileAccess } from "@/employer/_requirementCalls";
import { isEmployerTier, type EmployerTier } from "../../server-handlers/_employer-trust";

export interface EmployerAccess {
  loading: boolean;
  suspended: boolean;
  tier: EmployerTier | null;
  limits: EmployerProfileAccess["limits"];
  refresh: () => void;
}

export function useEmployerAccess(): EmployerAccess {
  const ctx = useEmployerData();
  const ctxSuspended = "suspended" in ctx && typeof ctx.suspended === "boolean" ? ctx.suspended : null;
  const ctxTier = "verificationTier" in ctx && isEmployerTier(ctx.verificationTier) ? ctx.verificationTier : null;

  const [fetched, setFetched] = useState<EmployerProfileAccess | null>(null);
  const [loading, setLoading] = useState(ctxSuspended == null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (ctxSuspended != null) return;
    let active = true;
    getEmployerAccess().then((res) => {
      if (!active) return;
      if (res.ok) setFetched(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ctxSuspended, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    loading,
    suspended: ctxSuspended ?? fetched?.suspended ?? false,
    tier: ctxTier ?? fetched?.tier ?? null,
    limits: fetched?.limits ?? null,
    refresh,
  };
}
