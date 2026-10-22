import { useEffect, useRef } from "react";

export const UNSAVED_NAV_PROMPT = "You have unsaved changes. Leave without saving?";

/** In-app links never fire beforeunload, so a dirty form is otherwise discarded by one stray click on the
    sidebar. Intercepts same-origin link clicks (capture phase, before the router sees them) while
    `isDirty()` is true and asks first. Pass a getter so refs such as "just submitted" are read at click time. */
export function useUnsavedNavGuard(isDirty: () => boolean) {
  const ref = useRef(isDirty);
  useEffect(() => { ref.current = isDirty; });
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!ref.current()) return;
      const anchor = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(UNSAVED_NAV_PROMPT)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
