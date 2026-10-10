"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEmployerData, Requirement } from "@/employer/EmployerDataContext";
import { RequirementForm, RequirementFormValues } from "@/employer/RequirementForm";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { ErrorRetry, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";

const SUSPENDED_SUBMIT_ERROR = "Your employer account is suspended, so requirements can't be edited. Contact support@hirestepx.com.";

export default function EditRequirementPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchRequirementDetail, updateRequirement } = useEmployerData();
  const access = useEmployerAccess();
  const router = useRouter();

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fetchRequirementDetail(id).then((data) => {
      if (cancelled) return;
      setRequirement(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, fetchRequirementDetail]);

  useEffect(() => load(), [load]);

  const handleSubmit = async (values: RequirementFormValues) => {
    if (access.suspended) {
      setSubmitError(SUSPENDED_SUBMIT_ERROR);
      return false;
    }
    const result = await updateRequirement(id, values);
    if ("error" in result) {
      setSubmitError(result.error);
      return false;
    }
    router.push(`/employer/requirements/${id}`);
    return true;
  };

  if (loading) return <PageSkeleton label="Loading requirement" />;

  if (!requirement) {
    return (
      <ErrorRetry
        title="Couldn't open this requirement"
        message="It may have been deleted, or we couldn't reach HireStepX. Try again, or go back to your requirements."
        onRetry={() => load()}
      >
        <Link
          href="/employer/requirements"
          className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
          style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.indigo, outlineColor: t.indigo }}
        >
          Back to requirements
        </Link>
      </ErrorRetry>
    );
  }

  return (
    <>
      {access.suspended && (
        <div style={{ maxWidth: 720, margin: "0 auto 16px" }}>
          <SuspendedBanner />
        </div>
      )}
      <RequirementForm mode="edit" initial={requirement} onSubmit={handleSubmit} submitError={submitError} setSubmitError={setSubmitError} />
    </>
  );
}
