/* HireStepX — Online/offline recovery hook
 *
 * Driven by the connection monitor (real request outcomes + heartbeat), not
 * raw `navigator.onLine`, so a captive portal or saturated link is treated as
 * offline and a flapping one isn't. While an interview is live this hook
 * holds a heartbeat lease so recovery is detected within seconds.
 *
 *   - isOffline mirrors monitor status === "offline" (drives the status chip).
 *   - The full-screen overlay is debounced (default 5s) so a brief blip
 *     doesn't slam the candidate with a modal.
 *   - On recovery: clear the overlay, drain queued work (evals, turn outbox)
 *     and upgrade practice questions to personalized ones if we fell back.
 */

import { useEffect, useRef } from "react";
import { acquireHeartbeat, getConnectionState, subscribeConnection } from "./connectionMonitor";
import { isReachable } from "./_connection-state";

export interface RecoveryHookConfig {
  setIsOffline: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  /** True while an interview is in progress (started, not finished). */
  active: boolean;
  /** Called on reconnect to retry queued LLM evaluation requests. */
  retryQueuedEvals: () => Promise<void> | void;
  /** Called on reconnect to drain locally queued turns / unsaved sessions. */
  flushOutbox: () => Promise<void> | void;
  /** Called on reconnect IF the engine's saveWarning text contains
      "practice questions" or "retry" (i.e. we fell back to fixed
      questions earlier and now want to upgrade to LLM ones). */
  fetchPersonalizedQuestions: () => void;
  /** Read at fire-time inside the recovery closure. */
  saveWarningRef: React.MutableRefObject<string>;
  /** Debounce window before showing the full-screen reconnect overlay. */
  debounceMs?: number;
}

export function useOnlineOfflineRecovery(cfg: RecoveryHookConfig): void {
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cfg.active) return;
    return acquireHeartbeat();
  }, [cfg.active]);

  useEffect(() => {
    const clearDebounce = () => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    };
    const onOffline = () => {
      const c = cfgRef.current;
      c.setIsOffline(true);
      if (!c.active) return;
      clearDebounce();
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (cfgRef.current.active && getConnectionState().status === "offline") cfgRef.current.setReconnecting(true);
      }, c.debounceMs ?? 5000);
    };
    const onRecovered = () => {
      const c = cfgRef.current;
      c.setIsOffline(false);
      c.setReconnecting(false);
      clearDebounce();
      Promise.resolve(c.retryQueuedEvals()).catch(() => { /* expected */ });
      Promise.resolve(c.flushOutbox()).catch(() => { /* expected */ });
      const sw = c.saveWarningRef.current;
      if (sw && (sw.includes("practice questions") || sw.includes("retry"))) c.fetchPersonalizedQuestions();
    };

    if (getConnectionState().status === "offline") onOffline();
    const unsub = subscribeConnection((next, prev) => {
      if (next.status === "offline" && prev.status !== "offline") onOffline();
      else if (isReachable(next) && !isReachable(prev)) onRecovered();
    });
    return () => { unsub(); clearDebounce(); };
  }, []);
}
