import { useCallback, useEffect, useRef } from "react";

/** Native "Leave site?" prompt while `active` is true and the guard has not
 *  been released. Returns `release()`: call it once the work the prompt was
 *  protecting is settled (session saved, or abandoned on purpose). Hard
 *  navigations after that go through silently. In-app (router) navigation
 *  never fires beforeunload, so it is unaffected either way. */
export function useBeforeUnloadGuard(active: boolean): () => void {
  const activeRef = useRef(active);
  const releasedRef = useRef(false);
  useEffect(() => { activeRef.current = active; });
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (releasedRef.current || !activeRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  return useCallback(() => { releasedRef.current = true; }, []);
}
