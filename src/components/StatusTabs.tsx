"use client";

/* Underline tab bar with optional icon and count per tab. Controlled and
   presentational: the caller owns which tab is active and what the tabbed
   panel shows (point its element at `panelId`). Arrow keys, Home and End move
   between tabs and only the active tab is in the tab order. */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "cn";

export interface StatusTabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export default function StatusTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  panelId,
  className,
}: {
  tabs: ReadonlyArray<StatusTabItem<K>>;
  value: K;
  onChange: (next: K) => void;
  label: string;
  idPrefix: string;
  panelId?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [moreRight, setMoreRight] = useState(false);

  /* A fade on the clipped edge tells a phone user the bar scrolls. */
  const measure = useCallback(() => {
    const el = listRef.current;
    if (el) setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, tabs.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const target =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (target == null) return;
    e.preventDefault();
    onChange(tabs[target].key);
    refs.current[target]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onScroll={measure}
      className={cn(
        "-mb-px flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        moreRight && "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]",
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 ease-out focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11",
              active ? "border-hx-indigo text-hx-indigo" : "border-transparent text-hx-ink-soft hover:text-hx-coal",
            )}
          >
            {tab.icon && <span aria-hidden="true" className="inline-flex">{tab.icon}</span>}
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                  active ? "bg-hx-indigo-100 text-hx-indigo" : "bg-hx-soft text-hx-ink-soft",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
