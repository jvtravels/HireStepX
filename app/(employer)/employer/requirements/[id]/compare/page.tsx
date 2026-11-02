"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import { EmptyNote, ErrorRetry, LinkCta } from "@/employer/_requirementAtoms";
import { PageSkeleton } from "@/employer/_consoleParts";
import { MIN_COMPARE, parseCompareIds } from "../_components/shortlistSelection";
import { CompareBoard } from "../_components/CompareBoard";

function BackLink({ requirementId }: { requirementId: string }) {
  return (
    <Link
      href={`/employer/requirements/${requirementId}`}
      className="inline-flex min-h-6 items-center gap-1 rounded text-[14px] font-semibold text-hx-indigo no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:min-h-11"
    >
      <ArrowLeftIcon size={14} aria-hidden="true" /> Back to shortlist
    </Link>
  );
}

export default function ComparePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { fetchRequirementDetail } = useEmployerData();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    fetchRequirementDetail(params.id).then((r) => {
      if (!active) return;
      setRequirement(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => load(), [load]);

  useEmployerBreadcrumb(requirement ? [{ label: requirement.title, path: `/employer/requirements/${params.id}` }, { label: "Compare candidates" }] : null);

  const wantedIds = parseCompareIds(searchParams);
  const chosen = wantedIds.flatMap((id) => requirement?.candidates.find((c) => c.id === id) ?? []);

  if (loading) return <PageSkeleton label="Loading candidates to compare" padded />;

  if (!requirement) {
    return (
      <ErrorRetry pageLevel title="Couldn't load this comparison" message="We couldn't reach HireStepX, or this job no longer exists." onRetry={() => load()}>
        <BackLink requirementId={params.id} />
      </ErrorRetry>
    );
  }

  if (chosen.length < MIN_COMPARE) {
    return (
      <>
        <EmptyNote
          pageLevel
          title="Pick two or three candidates to compare"
          action={<LinkCta variant="outline" href={`/employer/requirements/${requirement.id}`}>Back to shortlist</LinkCta>}
        >
          {chosen.length < wantedIds.length ? "Some candidates in this link could not be loaded for this job. They may have been removed, or they are not in the part of the list that has loaded." : ""}
          Tick the box next to two or three candidates on the shortlist, then choose Compare in the bar that appears.
        </EmptyNote>
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 px-4 pt-4 pb-6 md:px-7">
      <BackLink requirementId={requirement.id} />
      <CompareBoard requirementId={requirement.id} requirementTitle={requirement.title} required={requirement.skills} chosen={chosen} />
    </div>
  );
}
