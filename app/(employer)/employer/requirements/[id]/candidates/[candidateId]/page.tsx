"use client";

import { useParams } from "next/navigation";
import CandidateDetail from "./_components/CandidateDetail";

export default function CandidateDetailPage() {
  const params = useParams<{ id: string; candidateId: string }>();
  return <CandidateDetail requirementId={params.id} matchId={params.candidateId} />;
}
