"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { seedRequirements, Requirement, Candidate } from "./mockData";

/* Mocked-data layer for the employer console (see CLAUDE.md scope note in
   app/(employer)) — no Supabase table backs this yet. Company approval
   status and requirement/candidate state live in localStorage so the
   flow survives a refresh within one browser, but there is no real
   review queue on the other end. */

export type CompanyStatus = "none" | "pending" | "approved" | "rejected";

const STATUS_KEY = "hsx_employer_company_status";
const REQS_KEY = "hsx_employer_requirements";

interface EmployerDataContextValue {
  companyStatus: CompanyStatus;
  requirements: Requirement[];
  submitCompanyProfile: () => void;
  simulateRejection: () => void;
  resetCompanyProfile: () => void;
  addRequirement: (r: Pick<Requirement, "title" | "location" | "noticePeriodPref">) => string;
  unlockCandidate: (requirementId: string, candidateId: string) => void;
  getRequirement: (id: string) => Requirement | undefined;
}

const EmployerDataContext = createContext<EmployerDataContextValue | null>(null);

export function useEmployerData() {
  const ctx = useContext(EmployerDataContext);
  if (!ctx) throw new Error("useEmployerData must be used within EmployerDataProvider");
  return ctx;
}

export function EmployerDataProvider({ children }: { children: React.ReactNode }) {
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus>("none");
  const [requirements, setRequirements] = useState<Requirement[]>(seedRequirements);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedStatus = window.localStorage.getItem(STATUS_KEY) as CompanyStatus | null;
      if (storedStatus) setCompanyStatus(storedStatus);
      const storedReqs = window.localStorage.getItem(REQS_KEY);
      if (storedReqs) setRequirements(JSON.parse(storedReqs));
    } catch {
      // localStorage unavailable (private mode, SSR) — fall back to seed data
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STATUS_KEY, companyStatus);
    } catch {
      // ignore
    }
  }, [companyStatus, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(REQS_KEY, JSON.stringify(requirements));
    } catch {
      // ignore
    }
  }, [requirements, hydrated]);

  const submitCompanyProfile = useCallback(() => {
    setCompanyStatus("pending");
    // Demo-only auto-approval — a real review queue would flip this
    // server-side once someone actions the application.
    setTimeout(() => setCompanyStatus("approved"), 3000);
  }, []);

  const simulateRejection = useCallback(() => setCompanyStatus("rejected"), []);
  const resetCompanyProfile = useCallback(() => setCompanyStatus("none"), []);

  const addRequirement = useCallback((r: Pick<Requirement, "title" | "location" | "noticePeriodPref">) => {
    const id = `req-${Date.now()}`;
    const newReq: Requirement = { id, ...r, status: "generating", createdAt: new Date().toISOString().slice(0, 10), candidates: [] };
    setRequirements((prev) => [newReq, ...prev]);
    // Simulate the async matching job that generate-questions-style
    // endpoints would run — after this pass, real matching would call
    // analyze-jd-match.ts instead of resolving a timeout.
    setTimeout(() => {
      setRequirements((prev) =>
        prev.map((req) =>
          req.id === id
            ? { ...req, status: "ready", candidates: seedRequirements[0].candidates }
            : req
        )
      );
    }, 2600);
    return id;
  }, []);

  const unlockCandidate = useCallback((requirementId: string, candidateId: string) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id !== requirementId
          ? req
          : {
              ...req,
              candidates: req.candidates.map((c) =>
                c.id !== candidateId
                  ? c
                  : { ...c, unlocked: true, contact: { email: `${c.name.toLowerCase().replace(/\s+/g, ".")}@example.com`, phone: "+91 98XXX XXXXX" } }
              ),
            }
      )
    );
  }, []);

  const getRequirement = useCallback((id: string) => requirements.find((r) => r.id === id), [requirements]);

  const value: EmployerDataContextValue = {
    companyStatus,
    requirements,
    submitCompanyProfile,
    simulateRejection,
    resetCompanyProfile,
    addRequirement,
    unlockCandidate,
    getRequirement,
  };

  return <EmployerDataContext.Provider value={value}>{children}</EmployerDataContext.Provider>;
}

export type { Requirement, Candidate };
