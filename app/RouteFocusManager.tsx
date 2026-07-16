"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Move keyboard focus to #main-content on every route change.
 *
 * Without this, screen-reader and keyboard users land on stale focus
 * (often the link they just clicked, which has unmounted) and have to
 * tab from the top of the page on every navigation. Skip the first
 * mount — the user's initial focus is the URL bar / page chrome, not
 * an in-app element to overwrite.
 */
export function RouteFocusManager() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = document.getElementById("main-content");
    if (el) {
      el.focus({ preventScroll: true });
    }
    // Announce the navigation to screen readers. The #route-announcer live
    // region is defined in layout.tsx (role="status" aria-live="assertive").
    // Without this, focus moves silently and SR users get no confirmation.
    const announcer = document.getElementById("route-announcer");
    if (announcer) {
      announcer.textContent = "";
      // Microtask flush lets the DOM update before we set the announcement,
      // ensuring assertive live regions re-read even for identical titles.
      setTimeout(() => {
        announcer.textContent = document.title
          ? `Navigated to ${document.title.replace(/ ?[|·—–-] .*$/, "").trim()}`
          : "Page loaded";
      }, 50);
    }
  }, [pathname]);

  return null;
}
