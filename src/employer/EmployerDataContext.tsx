"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { authHeaders } from "@/supabase";
import { apiFetch } from "@/apiClient";
import { RequirementSummary, Requirement, Candidate, WorkMode } from "./mockData";

/* Real backend layer for the employer console — see server-handlers/
   employer-profile.ts, employer-requirements.ts,
   employer-requirement-detail.ts, employer-create-unlock-order.ts,
   employer-verify-unlock-payment.ts and the "Employer talent-roster
   feature" block in supabase-schema.sql.

   Employer approval is a human review step in the admin panel (see
   src/AdminDashboard.tsx "Employers" tab + server-handlers/admin-data.ts
   "employers"/"approve-employer"/"reject-employer"). This context just
   polls GET while status is "pending" so the console flips to the
   dashboard once an admin approves it, without a manual refresh. */

export type CompanyStatus = "none" | "pending" | "approved" | "rejected";

export interface UnlockOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
}

interface EmployerDataContextValue {
  companyStatus: CompanyStatus;
  companyStatusLoading: boolean;
  companyLogoUrl: string | null;
  companyName: string;
  companyWebsite: string;
  requirements: RequirementSummary[];
  requirementsLoading: boolean;
  submitCompanyProfile: (fields: { companyName: string; website: string; logoBase64?: string; logoContentType?: string }) => Promise<boolean>;
  resetCompanyProfile: () => void;
  addRequirement: (r: {
    title: string;
    locations: string[];
    noticePeriodPref?: string;
    description?: string;
    experienceMin?: number;
    experienceMax?: number;
    dueDate?: string;
    budgetMin?: number;
    budgetMax?: number;
    openPositions?: number;
    workMode?: WorkMode;
    skills?: string[];
    responsibilities?: string;
    niceToHave?: string;
    preferredIndustry?: string;
    preferredColleges?: string[];
    targetCompanies?: string[];
    perksAndBenefits?: string[];
  }) => Promise<string | null>;
  createUnlockOrder: (matchId: string) => Promise<UnlockOrder | null>;
  verifyUnlockPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => Promise<{ name: string; contact: { email: string } } | null>;
  fetchRequirementDetail: (id: string) => Promise<Requirement | null>;
  refreshRequirements: () => Promise<void>;
}

const EmployerDataContext = createContext<EmployerDataContextValue | null>(null);

export function useEmployerData() {
  const ctx = useContext(EmployerDataContext);
  if (!ctx) throw new Error("useEmployerData must be used within EmployerDataProvider");
  return ctx;
}

export function EmployerDataProvider({ children }: { children: React.ReactNode }) {
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus>("none");
  const [companyStatusLoading, setCompanyStatusLoading] = useState(true);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCompanyStatus = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/employer-profile", { headers });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCompanyStatus(data.status as CompanyStatus);
        setCompanyLogoUrl(typeof data.logoUrl === "string" ? data.logoUrl : null);
        setCompanyName(typeof data.companyName === "string" ? data.companyName : "");
        setCompanyWebsite(typeof data.website === "string" ? data.website : "");
      }
    } catch {
      // network hiccup — keep last known status, next poll/refresh retries
    } finally {
      setCompanyStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCompanyStatus();
  }, [refreshCompanyStatus]);

  // Poll while pending so the console flips to the dashboard once the
  // (currently lazy-auto-approve) review resolves, without a manual refresh.
  useEffect(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    if (companyStatus === "pending") {
      pollRef.current = setTimeout(refreshCompanyStatus, 4000);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [companyStatus, refreshCompanyStatus]);

  const refreshRequirements = useCallback(async () => {
    if (companyStatus !== "approved") return;
    setRequirementsLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/employer-requirements", { headers });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.requirements) setRequirements(data.requirements);
    } catch {
      // leave previous list in place on a transient failure
    } finally {
      setRequirementsLoading(false);
    }
  }, [companyStatus]);

  useEffect(() => {
    refreshRequirements();
  }, [refreshRequirements]);

  const submitCompanyProfile = useCallback(async (fields: { companyName: string; website: string; logoBase64?: string; logoContentType?: string }) => {
    const res = await apiFetch<{ status: CompanyStatus; companyName?: string; website?: string; logoUrl?: string | null }>("/api/employer-profile", fields, { method: "POST" });
    if (res.ok && res.data) {
      setCompanyStatus(res.data.status);
      setCompanyLogoUrl(res.data.logoUrl ?? null);
      setCompanyName(res.data.companyName ?? fields.companyName);
      setCompanyWebsite(res.data.website ?? fields.website);
      return true;
    }
    return false;
  }, []);

  // Server-side status stays "rejected" until a real resubmission lands —
  // this just lets the client show the onboarding form again so the user
  // can resubmit via submitCompanyProfile, which POSTs a fresh "pending" row.
  const resetCompanyProfile = useCallback(() => setCompanyStatus("none"), []);

  const addRequirement = useCallback(async (r: {
    title: string;
    locations: string[];
    noticePeriodPref?: string;
    description?: string;
    experienceMin?: number;
    experienceMax?: number;
    dueDate?: string;
    budgetMin?: number;
    budgetMax?: number;
    openPositions?: number;
    workMode?: WorkMode;
    skills?: string[];
    responsibilities?: string;
    niceToHave?: string;
    preferredIndustry?: string;
    preferredColleges?: string[];
    targetCompanies?: string[];
    perksAndBenefits?: string[];
  }) => {
    const res = await apiFetch<{ id: string }>("/api/employer-requirements", r, { method: "POST" });
    if (res.ok && res.data) {
      refreshRequirements();
      return res.data.id;
    }
    return null;
  }, [refreshRequirements]);

  const createUnlockOrder = useCallback(async (matchId: string) => {
    const res = await apiFetch<UnlockOrder>(
      "/api/employer-create-unlock-order",
      { matchId },
      { method: "POST" },
    );
    if (res.ok && res.data) return res.data;
    return null;
  }, []);

  const verifyUnlockPayment = useCallback(async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const res = await apiFetch<{ name: string; contact: { email: string } }>(
      "/api/employer-verify-unlock-payment",
      payload,
      { method: "POST" },
    );
    if (res.ok && res.data) return res.data;
    return null;
  }, []);

  const fetchRequirementDetail = useCallback(async (id: string): Promise<Requirement | null> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return null;
      return data as Requirement;
    } catch {
      return null;
    }
  }, []);

  const value: EmployerDataContextValue = {
    companyStatus,
    companyStatusLoading,
    companyLogoUrl,
    companyName,
    companyWebsite,
    requirements,
    requirementsLoading,
    submitCompanyProfile,
    resetCompanyProfile,
    addRequirement,
    createUnlockOrder,
    verifyUnlockPayment,
    fetchRequirementDetail,
    refreshRequirements,
  };

  return <EmployerDataContext.Provider value={value}>{children}</EmployerDataContext.Provider>;
}

export type { Requirement, RequirementSummary, Candidate };
