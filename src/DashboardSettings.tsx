"use client";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { authHeaders, getPaymentHistory, type PaymentRecord } from "./supabase";
import { useDashboardUIActions } from "./DashboardContext";
import EmployerVisibilityCard from "./EmployerVisibilityCard";
import {
  PageHeader,
  FlatSection,
  AccountSection,
  PlanUsageSection,
  SoundsSection,
  DangerZoneSection,
} from "./settingsSections";

/* Cream-mode tokens — derive from the single source of truth so a WCAG
 * fix in auth/_tokens.ts can never silently undo itself here. */
import { tokens as T } from "./auth/_tokens";
const c = {
  border: T.line,
  graphite: T.creamRaised,
} as const;

export default function SettingsPage() {
  useDocTitle("Settings");
  const { user: authUser, logout: authLogout, updateUser: authUpdateUser, resetPassword } = useAuth();
  const { showToast, setShowUpgradeModal } = useDashboardUIActions();
  const onLogout = () => { authLogout(); };

  // Danger zone
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  // Password
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Billing history — loaded eagerly since the page is one long stacked
  // view now (no more "Plan" tab gating when it fetches). Cache-first like
  // DashboardContext's sessions/events: a tab switch back into Settings
  // shows the last-known list instantly instead of a spinner, then
  // refreshes from the network in the background.
  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    if (!authUser?.id) return [];
    try {
      const cached = localStorage.getItem(`hirestepx_cache_payments_${authUser.id}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [paymentsLoading, setPaymentsLoading] = useState(payments.length === 0);
  useEffect(() => {
    if (!authUser?.id) return;
    const cacheKey = `hirestepx_cache_payments_${authUser.id}`;
    getPaymentHistory(authUser.id).then(data => {
      setPayments(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* expected: localStorage may be unavailable */ }
    }).finally(() => setPaymentsLoading(false));
  }, [authUser?.id]);

  const handlePasswordReset = async () => {
    if (!authUser?.email) return;
    setResetLoading(true);
    const result = await resetPassword(authUser.email);
    setResetLoading(false);
    if (result.success) { setResetSent(true); showToast("Password reset email sent"); setTimeout(() => setResetSent(false), 10000); }
    else showToast(result.error || "Failed to send reset email");
  };

  // Map tier ids to the actual product names used on pricing/checkout
  // (dashboardComponents.tsx) instead of naively capitalizing the id —
  // "starter" is sold and billed as "Sprint Pack", not "Starter".
  const TIER_DISPLAY_NAMES: Record<string, string> = { free: "Free", starter: "Sprint Pack", team: "Team" };
  const tierId = authUser?.subscriptionTier || "free";
  const tierLabel = TIER_DISPLAY_NAMES[tierId] || (tierId.charAt(0).toUpperCase() + tierId.slice(1));

  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
        <PageHeader title="Settings" desc="Manage your subscription, payments, privacy, and account security." />

        <FlatSection title="Plan & Usage">
          <PlanUsageSection
            authUser={authUser} tierLabel={tierLabel}
            confirmCancel={confirmCancel} setConfirmCancel={setConfirmCancel}
            cancelLoading={cancelLoading} setCancelLoading={setCancelLoading}
            cancelMsg={cancelMsg} setCancelMsg={setCancelMsg}
            authUpdateUser={authUpdateUser} showToast={showToast}
            setShowUpgradeModal={setShowUpgradeModal}
            authHeaders={authHeaders}
            payments={payments} paymentsLoading={paymentsLoading}
          />
        </FlatSection>

        <FlatSection title="Account">
          <AccountSection
            resetLoading={resetLoading} resetSent={resetSent}
            handlePasswordReset={handlePasswordReset}
            isOAuthOnly={authUser?.signedInVia === "google"}
          />
        </FlatSection>

        <FlatSection title="Employer visibility">
          <EmployerVisibilityCard showToast={showToast} />
        </FlatSection>

        <FlatSection title="Sounds">
          <SoundsSection />
        </FlatSection>

        <FlatSection title="Danger Zone" last>
          <DangerZoneSection
            authUser={authUser}
            confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
            deleteEmailInput={deleteEmailInput} setDeleteEmailInput={setDeleteEmailInput}
            deleteLoading={deleteLoading} setDeleteLoading={setDeleteLoading}
            deleteMsg={deleteMsg} setDeleteMsg={setDeleteMsg}
            onLogout={onLogout} showToast={showToast}
            authHeaders={authHeaders}
          />
        </FlatSection>
      </div>
    </div>
  );
}
