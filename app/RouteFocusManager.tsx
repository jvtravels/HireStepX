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
  }, [pathname]);

  return null;
}
