/* HireStepX — Audio unlock hooks for the interview surface
 *
 * Two small mount-time effects extracted from useInterviewEngine.ts:
 *
 *   useForceAudioUnlockOnMount — calls retryUnlockAudio() once on
 *     mount. Force-resets the module-level _audioUnlocked flag from
 *     tts.ts so re-entering /interview from /score doesn't fail with
 *     a stale unlock (was QA bug 25).
 *
 *   useClickRecoverAutoplay — installs a document-level click+touch
 *     listener that re-runs unlock if the user gestures and we've
 *     detected an autoplay block. Backstop for the rare case where
 *     the mount-time unlock fails (page restored from bfcache, etc).
 */

import { useEffect } from "react";
import { isAutoplayBlocked, retryUnlockAudio } from "./tts";

/** Mount-time force-unlock. Always runs once per InterviewInner mount. */
export function useForceAudioUnlockOnMount(): void {
  useEffect(() => {
    retryUnlockAudio();
  }, []);
}

/**
 * Document-level recovery — if the user clicks/taps anywhere AND the
 * module flag says autoplay is blocked, re-attempt unlock and surface
 * a soft toast so the user knows audio is back.
 */
export function useClickRecoverAutoplay(toast: (msg: string, kind: "info" | "error") => void): void {
  useEffect(() => {
    const handler = () => {
      if (isAutoplayBlocked()) {
        retryUnlockAudio();
        toast("Audio re-enabled. Voice will play on next question.", "info");
      }
    };
    document.addEventListener("click", handler, { once: false });
    document.addEventListener("touchstart", handler, { once: false });
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [toast]);
}
