/* HireStepX — Online/offline recovery hook
 *
 * Extracted from useInterviewEngine.ts. Listens for browser online /
 * offline events and:
 *
 *   - Sets isOffline immediately (drives the inline status chip).
 *   - Debounces the full-screen ReconnectingOverlay by 5 seconds so
 *     a single 4G blip on flaky Indian networks doesn't slam the
 *     user with an overlay every few seconds. Only escalates if the
 *     user is genuinely stuck.
 *   - On reconnect: cancels the pending overlay, retries queued
 *     evaluations, and re-fetches questions if we fell back to
 *     practice questions earlier.
 *
 * Pulled out so the engine doesn't have 50 LOC of network plumbing
 * inline. The hook accepts the engine's setters + refs by reference
 * — clean separation of concerns without deeper refactoring.
 */

import { useEffect, useRef } from "react";

export interface RecoveryHookConfig {
  setIsOffline: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  reconnectAttemptRef: React.MutableRefObject<number>;
  currentStepRef: React.MutableRefObject<number>;
  interviewEndedRef: React.MutableRefObject<boolean>;
  /** Called on reconnect to retry queued LLM evaluation requests. */
  retryQueuedEvals: () => Promise<void> | void;
  /** Called on reconnect IF the engine's saveWarning text contains
      "practice questions" or "retry" (i.e. we fell back to fixed
      questions earlier and now want to upgrade to LLM ones). */
  fetchPersonalizedQuestions: () => void;
  /** Read at fire-time inside the goOnline closure. */
  saveWarningRef: React.MutableRefObject<string>;
  /** Debounce window before showing the full-screen reconnect overlay. */
  debounceMs?: number;
}

export function useOnlineOfflineRecovery(cfg: RecoveryHookConfig): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const debounce = cfg.debounceMs ?? 5000;
    const goOffline = () => {
      cfg.setIsOffline(true);
      // Skip overlay if we haven't started or session is done — those
      // states have no progress to "save"; the inline chip is enough.
      if (cfg.currentStepRef.current > 0 && !cfg.interviewEndedRef.current) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (!navigator.onLine && !cfg.interviewEndedRef.current) {
            cfg.reconnectAttemptRef.current += 1;
            cfg.setReconnecting(true);
          }
          debounceRef.current = null;
        }, debounce);
      }
    };
    const goOnline = () => {
      cfg.setIsOffline(false);
      cfg.setReconnecting(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Best-effort retries — don't await
      Promise.resolve(cfg.retryQueuedEvals()).catch(() => { /* expected */ });
      const sw = cfg.saveWarningRef.current;
      if (sw && (sw.includes("practice questions") || sw.includes("retry"))) {
        cfg.fetchPersonalizedQuestions();
      }
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Mount-only — config refs read at fire-time, not on render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
