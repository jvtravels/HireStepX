"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { RequirementForm, RequirementFormValues } from "@/employer/RequirementForm";
import { SuspendedBanner } from "@/employer/_requirementAtoms";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";

const SUSPENDED_SUBMIT_ERROR = "Your employer account is suspended, so new requirements can't be posted. Contact support@hirestepx.com.";

export default function PostRequirementPage() {
  const { addRequirement } = useEmployerData();
  const access = useEmployerAccess();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (values: RequirementFormValues) => {
    if (access.suspended) {
      setSubmitError(SUSPENDED_SUBMIT_ERROR);
      return false;
    }
    const result = await addRequirement(values);
    if ("error" in result) {
      setSubmitError(result.error);
      return false;
    }
    router.push(`/employer/requirements/${result.id}`);
    return true;
  };

  return (
    <>
      {access.suspended && (
        <div style={{ maxWidth: 720, margin: "0 auto 16px" }}>
          <SuspendedBanner />
        </div>
      )}
      <RequirementForm mode="create" onSubmit={handleSubmit} submitError={submitError} setSubmitError={setSubmitError} />
    </>
  );
}
