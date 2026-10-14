"use client";

import { useEffect, useState } from "react";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import { STAGE_LABEL } from "@/employer/_atoms";
import type { RequirementStage } from "@/employer/mockData";

export interface JobMessage {
  tone: "error" | "success";
  text: string;
}

/** Stage change and reopen for one requirement, with optimistic patching and
    a message the page shows next to the header. */
export function useJobActions(requirement: Requirement | null, onPatch: (patch: Partial<Requirement>) => void, onReload: () => void) {
  const { updateRequirementStage, reopenRequirement } = useEmployerData();
  const [message, setMessage] = useState<JobMessage | null>(null);
  const [reopenSaving, setReopenSaving] = useState(false);

  // A success note is a confirmation, not state, so it fades; errors stay until
  // the next action because they need a decision.
  useEffect(() => {
    if (message?.tone !== "success") return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const changeStage = async (stage: RequirementStage) => {
    if (!requirement) return;
    const previous = requirement.stage;
    setMessage(null);
    onPatch({ stage });
    const ok = await updateRequirementStage(requirement.id, stage);
    if (!ok) {
      onPatch({ stage: previous });
      setMessage({ tone: "error", text: "Couldn't update the stage. Nothing was changed, so please try again." });
      return;
    }
    setMessage({ tone: "success", text: `Stage changed to ${STAGE_LABEL[stage]}.` });
  };

  const reopen = async () => {
    if (!requirement) return;
    setReopenSaving(true);
    setMessage(null);
    const ok = await reopenRequirement(requirement.id);
    setReopenSaving(false);
    if (!ok) {
      setMessage({ tone: "error", text: "Couldn't reopen this requirement. Please try again." });
      return;
    }
    setMessage({ tone: "success", text: "Requirement reopened. Re-matching candidates now." });
    onReload();
  };

  return { message, reopenSaving, changeStage, reopen };
}
