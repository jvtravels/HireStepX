"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";

/** A link that prefetches its route only once the user shows intent (hover or
    keyboard focus). A list with many rows otherwise prefetches every row from
    the viewport, twice over, for pages most people never open. */
export default function HoverPrefetchLink({ onMouseEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => { setActive(true); onMouseEnter?.(e); }}
      onFocus={(e) => { setActive(true); onFocus?.(e); }}
    />
  );
}
