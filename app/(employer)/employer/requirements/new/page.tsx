"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, Eyebrow, FieldLabel, HelpText, PrimaryCta } from "@/employer/_atoms";

export default function PostRequirementPage() {
  const { addRequirement } = useEmployerData();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [noticePeriodPref, setNoticePeriodPref] = useState("Any");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 1 && location.trim().length > 1;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    const id = await addRequirement({
      title: title.trim(),
      location: location.trim(),
      noticePeriodPref,
      description: description.trim(),
    });
    if (!id) {
      setSubmitting(false);
      setSubmitError("Couldn't create this requirement — please try again.");
      return;
    }
    router.push(`/employer/requirements/${id}`);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Eyebrow tone="indigo">New requirement</Eyebrow>
      <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "8px 0 24px" }}>Post a requirement</h1>
      <Card>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Role title</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Senior Frontend Engineer"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <FieldLabel required>Location</FieldLabel>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bengaluru (hybrid), Remote, …"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <FieldLabel>Notice period preference</FieldLabel>
            <select
              value={noticePeriodPref}
              onChange={(e) => setNoticePeriodPref(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, background: t.white, boxSizing: "border-box" }}
            >
              <option>Any</option>
              <option>Immediate</option>
              <option>Immediate–30 days</option>
              <option>30 days</option>
              <option>60 days</option>
            </select>
          </div>
          <div>
            <FieldLabel>Role description (optional)</FieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Paste the JD or a few lines about what you're looking for…"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
            />
            <HelpText>We use this to match against candidates' practice sessions — the more specific, the better the shortlist.</HelpText>
          </div>
          {submitError && (
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.error, margin: 0 }}>{submitError}</p>
          )}
          <PrimaryCta type="submit" full disabled={!canSubmit || submitting}>
            {submitting ? "Generating shortlist…" : "Generate shortlist"}
          </PrimaryCta>
        </form>
      </Card>
    </div>
  );
}
