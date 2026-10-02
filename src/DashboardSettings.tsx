"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { authHeaders, getPaymentHistory, type PaymentRecord } from "./supabase";
import { useDashboardCore, useDashboardUI } from "./DashboardContext";
import { DataLoadingSkeleton } from "./dashboardComponents";
import {
  focusOutBase,
  PageHeader,
  FlatSection,
  AccountSection,
  PlanUsageSection,
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
  const { persisted, updatePersisted: onUpdate } = useDashboardCore();
  const { dataLoading, showToast, setShowUpgradeModal } = useDashboardUI();
  const onLogout = () => { authLogout(); };

  // Profile
  const [editName, setEditName] = useState(persisted.userName);
  const [editRole, setEditRole] = useState(persisted.targetRole);
  const [editCompany, setEditCompany] = useState(authUser?.targetCompany || "");
  const [editIndustry, setEditIndustry] = useState(authUser?.industry || "");
  const [editCity, setEditCity] = useState(authUser?.city || "");
  const [editExperience, setEditExperience] = useState(authUser?.experienceLevel || "");

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
  // view now (no more "Plan" tab gating when it fetches).
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  useEffect(() => {
    if (!authUser?.id) return;
    setPaymentsLoading(true);
    getPaymentHistory(authUser.id).then(setPayments).finally(() => setPaymentsLoading(false));
  }, [authUser?.id]);

  const isDirty = editName !== persisted.userName || editRole !== persisted.targetRole || editCompany !== (authUser?.targetCompany || "") || editIndustry !== (authUser?.industry || "") || editCity !== (authUser?.city || "") || editExperience !== (authUser?.experienceLevel || "");

  // Auto-save on blur for text fields
  const focusOut = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusOutBase(e);
    setTimeout(() => {
      if (editName !== persisted.userName || editRole !== persisted.targetRole || editCompany !== (authUser?.targetCompany || "") || editIndustry !== (authUser?.industry || "") || editCity !== (authUser?.city || "")) {
        onUpdate({ userName: editName, targetRole: editRole });
        Promise.resolve(authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry, city: editCity }))
          .then(() => showToast("Saved"))
          .catch(() => showToast("Failed to save. Try again."));
      }
    }, 0);
  }, [editName, editRole, editCompany, editIndustry, editCity, persisted.userName, persisted.targetRole, authUser?.targetCompany, authUser?.industry, authUser?.city, onUpdate, authUpdateUser, showToast]);

  // beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (dataLoading) return <DataLoadingSkeleton />;

  const handlePasswordReset = async () => {
    if (!authUser?.email) return;
    setResetLoading(true);
    const result = await resetPassword(authUser.email);
    setResetLoading(false);
    if (result.success) { setResetSent(true); showToast("Password reset email sent"); setTimeout(() => setResetSent(false), 10000); }
    else showToast(result.error || "Failed to send reset email");
  };

  const tierLabel = (authUser?.subscriptionTier || "free").charAt(0).toUpperCase() + (authUser?.subscriptionTier || "free").slice(1);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
        <PageHeader title="Settings" desc="Manage your subscription, payments, and account security." />

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
            editName={editName} setEditName={setEditName}
            editRole={editRole} setEditRole={setEditRole}
            editCompany={editCompany} setEditCompany={setEditCompany}
            editIndustry={editIndustry} setEditIndustry={setEditIndustry}
            editCity={editCity} setEditCity={setEditCity}
            editExperience={editExperience} setEditExperience={setEditExperience}
            userName={persisted.userName} email={authUser?.email || ""}
            resetLoading={resetLoading} resetSent={resetSent}
            handlePasswordReset={handlePasswordReset}
            isOAuthOnly={authUser?.signedInVia === "google"}
            focusOut={focusOut}
            authUpdateUser={authUpdateUser}
          />
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
