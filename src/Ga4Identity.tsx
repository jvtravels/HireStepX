"use client";
import { useEffect } from "react";
import { useAuth } from "./AuthContext";
import { setGa4User, setGa4UserProperties } from "./ga4Events";
import { isInternalTestUser } from "./posthogClient";

/** Ties GA4 to the signed-in user and exposes plan/onboarding state as user-scoped dimensions. */
export default function Ga4Identity() {
  const { user } = useAuth();
  const id = user?.id;
  const tier = user?.subscriptionTier;
  const onboarded = user?.hasCompletedOnboarding;
  const method = user?.signedInVia;
  const experience = user?.experienceLevel;
  useEffect(() => {
    if (!id) return;
    setGa4User(id, isInternalTestUser(id));
    setGa4UserProperties({ subscription_tier: tier, onboarded, sign_in_method: method, experience_level: experience });
  }, [id, tier, onboarded, method, experience]);
  return null;
}
