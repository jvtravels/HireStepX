"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEmployerData, Requirement } from "@/employer/EmployerDataContext";
import { RequirementForm, RequirementFormValues } from "@/employer/RequirementForm";
import { tokens as t, fonts as f } from "@/auth/_tokens";

export default function EditRequirementPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchRequirementDetail, updateRequirement } = useEmployerData();
  const router = useRouter();

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchRequirementDetail(id);
      if (!cancelled) {
        setRequirement(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchRequirementDetail]);

  const handleSubmit = async (values: RequirementFormValues) => {
    const ok = await updateRequirement(id, values);
    if (!ok) return false;
    router.push(`/employer/requirements/${id}`);
    return true;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 0", fontFamily: f.sans, color: t.inkFaint }}>
        Loading requirement…
      </div>
    );
  }

  if (!requirement) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 0", fontFamily: f.sans, color: t.inkFaint }}>
        We couldn't find this requirement.
      </div>
    );
  }

  return (
    <RequirementForm
      mode="edit"
      initial={requirement}
      onSubmit={handleSubmit}
      submitError={submitError}
      setSubmitError={setSubmitError}
    />
  );
}
