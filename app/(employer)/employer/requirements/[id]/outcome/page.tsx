"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { useToast } from "@/Toast";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, Eyebrow, FieldLabel, OutlineCta, PrimaryCta } from "@/employer/_atoms";

const OUTCOMES = ["Hired", "Interviewing", "Not a fit", "No response yet"] as const;

export default function OutcomeFeedbackPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getRequirement } = useEmployerData();
  const { toast } = useToast();
  const requirement = getRequirement(params.id);
  const candidateId = searchParams.get("candidate");
  const candidate = requirement?.candidates.find((c) => c.id === candidateId);

  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  if (!requirement || !candidate) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Candidate not found for this requirement.</p>
      </Card>
    );
  }

  const handleSubmit = () => {
    // Mocked-data pass: this feedback isn't persisted anywhere yet — it
    // would feed the matching model's fairness/quality loop in a real build.
    setSent(true);
    toast("Thanks — this helps us improve future shortlists", "success");
  };

  if (sent) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <h1 style={{ fontFamily: f.serif, fontSize: 24, color: t.coal, margin: "0 0 8px" }}>Thanks for the feedback</h1>
        <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginBottom: 20 }}>
          It's noted against {candidate.name} for {requirement.title}.
        </p>
        <OutlineCta onClick={() => router.push(`/employer/requirements/${requirement.id}`)}>Back to shortlist</OutlineCta>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <Eyebrow tone="indigo">Outcome feedback</Eyebrow>
      <h1 style={{ fontFamily: f.serif, fontSize: 26, color: t.coal, margin: "8px 0 4px" }}>
        How did it go with {candidate.name}?
      </h1>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginBottom: 20 }}>{requirement.title}</p>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Outcome</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${outcome === o ? t.indigo : t.lineStrong}`,
                    background: outcome === o ? t.indigo100 : "transparent",
                    color: outcome === o ? t.indigoDeep : t.coal,
                    fontFamily: f.sans,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything that would help us improve future shortlists?"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <PrimaryCta full disabled={!outcome} onClick={handleSubmit}>
            Submit feedback
          </PrimaryCta>
        </div>
      </Card>
    </div>
  );
}
