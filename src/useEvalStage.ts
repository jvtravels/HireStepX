import { useEffect, useState } from "react";
import { apiFetch } from "./apiClient";
import { mergeEvalStage, parseEvalStage, type EvalStage } from "./_eval-progress";

const FIRST_POLL_MS = 1500;
const POLL_MS = 3000;
const MAX_CONSECUTIVE_FAILURES = 3;

/* Polls the server-reported grading stage while the report loads. Goes through
   apiFetch (XHR) per the extension-hang rule in CLAUDE.md. Purely cosmetic: it
   returns null until the server reports something and gives up quietly on
   errors, so the caller keeps its generic loading copy. */
export function useEvalStage(sessionId: string | undefined): EvalStage | null {
  const [stage, setStage] = useState<EvalStage | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const tick = async () => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        const res = await apiFetch<{ stage?: unknown }>("/api/evaluate-progress", { sessionId }, { signal: ac.signal, timeoutMs: 5000 });
        if (ac.signal.aborted) return;
        if (res.ok) {
          failures = 0;
          setStage((prev) => mergeEvalStage(prev, parseEvalStage(res.data?.stage)));
        } else if (++failures >= MAX_CONSECUTIVE_FAILURES) {
          return;
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, FIRST_POLL_MS);
    return () => {
      ac.abort();
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return stage;
}
