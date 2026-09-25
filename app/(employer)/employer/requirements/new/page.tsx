"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { RequirementForm, RequirementFormValues } from "@/employer/RequirementForm";

export default function PostRequirementPage() {
  const { addRequirement } = useEmployerData();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (values: RequirementFormValues) => {
    const id = await addRequirement(values);
    if (!id) return false;
    router.push(`/employer/requirements/${id}`);
    return true;
  };

  return (
    <RequirementForm
      mode="create"
      onSubmit={handleSubmit}
      submitError={submitError}
      setSubmitError={setSubmitError}
    />
  );
}
