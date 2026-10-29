import { useCallback, useEffect, useState } from "react";
import { useEmployerData, type CandidateReviews, type ReviewRating } from "@/employer/EmployerDataContext";

export interface TeamReviewsState {
  enabled: boolean;
  data: CandidateReviews | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
  save: (rating: ReviewRating, reason: string) => Promise<string | null>;
}

/** Loads the blind team reviews once. `save` resolves to an error message, or null on success. */
export function useTeamReviews(matchId: string): TeamReviewsState {
  const { fetchCandidateReviews, saveCandidateReview, teamsEnabled } = useEmployerData();
  const enabled = teamsEnabled;
  const [data, setData] = useState<CandidateReviews | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchCandidateReviews(matchId).then((d) => {
      if (!active) return;
      setData(d);
      setFailed(d === null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [enabled, fetchCandidateReviews, matchId, nonce]);

  const save = useCallback(async (rating: ReviewRating, reason: string) => {
    const res = await saveCandidateReview(matchId, rating, reason);
    if (res.ok) { setData(res.data); return null; }
    return res.error.error || "Couldn't save your review. Please try again.";
  }, [saveCandidateReview, matchId]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { enabled, data, loading, failed, retry, save };
}
