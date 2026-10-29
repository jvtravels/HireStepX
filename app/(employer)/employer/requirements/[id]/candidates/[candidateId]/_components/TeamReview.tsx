import { useCallback, useState } from "react";
import { cn } from "cn";
import { useEmployerData, type CandidateReview, type ReviewRating } from "@/employer/EmployerDataContext";
import { HelpText, OutlineCta } from "@/employer/_atoms";
import { Panel } from "@/employer/_panelParts";
import { relativeTime } from "@/employer/teamActivity";
import type { TeamReviewsState } from "./useTeamReviews";

const RATINGS: Array<{ value: ReviewRating; label: string }> = [
  { value: 1, label: "Strong no" },
  { value: 2, label: "Lean no" },
  { value: 3, label: "Lean yes" },
  { value: 4, label: "Strong yes" },
];
const LABEL: Record<ReviewRating, string> = { 1: "Strong no", 2: "Lean no", 3: "Lean yes", 4: "Strong yes" };
const MAX = 500;

function ReviewLine({ r, you }: { r: CandidateReview; you?: boolean }) {
  return (
    <li className="flex min-w-0 items-start gap-2.5">
      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.rating >= 3 ? "bg-hx-success" : "bg-hx-error-ink")} />
      <div className="min-w-0">
        <p className="m-0 break-words text-[13px] text-hx-coal">
          <strong>{LABEL[r.rating]}</strong>
          <span className="text-hx-neutral-ink"> · {you ? "You" : r.reviewerEmail || "A teammate"} · {relativeTime(r.updatedAt)}</span>
        </p>
        <p className="m-0 mt-0.5 break-words text-[13px] leading-relaxed text-hx-neutral-ink">{r.reason}</p>
      </div>
    </li>
  );
}

export function TeamReview({ reviews }: { reviews: TeamReviewsState }) {
  const { suspended } = useEmployerData();
  const { data, loading, failed, retry, save, enabled } = reviews;
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!rating || !reason.trim()) return;
    setSaving(true);
    setError(null);
    const err = await save(rating, reason.trim());
    setSaving(false);
    if (err) setError(err);
    else setEditing(false);
  }, [rating, reason, save]);

  if (!enabled) return null;
  const mine = data?.mine ?? null;
  // The server enforces who may write (candidates.manage); a viewer sees its message if they try.
  const showForm = !suspended && data && (!mine || editing);

  return (
    <Panel id="team-review-heading" title="Team review">
      {loading ? (
        <HelpText>Loading reviews…</HelpText>
      ) : failed || !data ? (
        <div>
          <HelpText tone="error">Couldn't load team reviews.</HelpText>
          <div className="mt-2"><OutlineCta size="sm" onClick={retry}>Try again</OutlineCta></div>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {data.summary?.disagreement && (
            <p role="status" className="m-0 rounded-lg border border-hx-warning bg-hx-warning-100 px-2.5 py-2 text-[13px] font-semibold text-hx-warning-ink">
              Your team disagrees: {data.summary.yes} lean yes, {data.summary.no} lean no. Discuss before moving them on.
            </p>
          )}
          {mine && !editing && <ul className="m-0 grid list-none gap-2.5 p-0"><ReviewLine r={mine} you /></ul>}
          {showForm && (
            <div className="grid gap-2.5">
              <div role="radiogroup" aria-label="Your recommendation" className="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-1.5">
                {RATINGS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={rating === o.value}
                    onClick={() => setRating(o.value)}
                    className={cn(
                      "cursor-pointer rounded-lg border px-1.5 py-2 text-[13px] font-semibold",
                      rating === o.value ? "border-hx-indigo bg-hx-indigo text-white" : "border-hx-line bg-white text-hx-coal",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <label className="grid gap-1 text-[13px] text-hx-neutral-ink">
                Why? One or two lines your team can act on.
                <textarea
                  value={reason}
                  maxLength={MAX}
                  rows={3}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-w-0 resize-y rounded-lg border border-hx-line p-2.5 text-sm text-hx-coal"
                />
              </label>
              {error && <HelpText tone="error">{error}</HelpText>}
              <div className="flex flex-wrap items-center gap-2">
                <OutlineCta tone="indigo" size="sm" onClick={submit} disabled={!rating || !reason.trim()} loading={saving}>
                  {mine ? "Update review" : "Submit review"}
                </OutlineCta>
                {editing && <OutlineCta size="sm" onClick={() => setEditing(false)}>Cancel</OutlineCta>}
                <span className="text-xs text-hx-neutral-ink">{reason.length}/{MAX}</span>
              </div>
            </div>
          )}
          {mine && !editing && !suspended && (
            <div><OutlineCta size="sm" onClick={() => { setRating(mine.rating); setReason(mine.reason); setEditing(true); }}>Edit my review</OutlineCta></div>
          )}
          {data.revealed && data.others.length > 0 && (
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {data.others.map((r) => <ReviewLine key={r.reviewerUserId} r={r} />)}
            </ul>
          )}
          {!data.revealed && (
            <HelpText>
              {data.hiddenCount > 0
                ? `${data.hiddenCount} teammate${data.hiddenCount === 1 ? " has" : "s have"} reviewed. Submit yours to see theirs, so nobody anchors on a colleague.`
                : "Reviews are blind: you see teammates' views only after submitting your own."}
            </HelpText>
          )}
          {data.revealed && data.others.length === 0 && <HelpText>No teammate has reviewed yet.</HelpText>}
        </div>
      )}
    </Panel>
  );
}
