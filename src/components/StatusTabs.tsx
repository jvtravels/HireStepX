"use client";

/* Line tabs with an optional icon and count per tab, built on the shared Tabs.
   Controlled and presentational: the caller owns which tab is active and what
   the tabbed panel shows (point its element at `panelId`). Adds a scroll fade
   so a phone user can tell the bar is clipped. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  listClassName,
}: {
  tabs: ReadonlyArray<StatusTabItem<K>>;
  value: K;
  onChange: (next: K) => void;
  label: string;
  idPrefix: string;
  panelId?: string;
  className?: string;
  listClassName?: string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [moreRight, setMoreRight] = useState(false);
  const barRef = useRef<HTMLSpanElement | null>(null);
  const [indicator, setIndicator] = useState(false);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const el = listRef.current;
    if (el) setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const placeIndicator = useCallback(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]');
    const bar = barRef.current;
    if (active && bar) {
      bar.style.width = `${active.offsetWidth}px`;
      bar.style.transform = `translateX(${active.offsetLeft}px)`;
      setIndicator(true);
    }
  }, []);

  /* The first placement must not slide in from zero, so transitions are only enabled after it. */
  useLayoutEffect(() => {
    placeIndicator();
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [placeIndicator]);

  useLayoutEffect(() => {
    placeIndicator();
  }, [placeIndicator, value, tabs]);

  useEffect(() => {
    window.addEventListener("resize", placeIndicator);
    return () => window.removeEventListener("resize", placeIndicator);
  }, [placeIndicator]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, tabs.length]);

  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as K)} className={cn("min-w-0", className)}>
      <TabsList
        ref={listRef}
        variant="line"
        aria-label={label}
        onScroll={measure}
        className={cn("relative w-auto border-b-0", listClassName, moreRight && "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]")}
      >
        {tabs.map((tab) => {
          const active = tab.key === value;
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              id={`${idPrefix}-tab-${tab.key}`}
              aria-controls={panelId}
              className={indicator ? "group-data-[variant=line]/tabs-list:data-active:after:opacity-0" : undefined}
            >
              {tab.icon && <span aria-hidden="true" className="inline-flex">{tab.icon}</span>}
              {tab.label}
              {tab.count != null && (
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-xs font-medium tabular-nums",
                    active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
        <span
          ref={barRef}
          aria-hidden="true"
          className={cn("pointer-events-none absolute bottom-0 left-0 h-0.5 w-0 bg-foreground", animate && "transition-[transform,width] duration-200 ease-out motion-reduce:transition-none")}
        />
      </TabsList>
    </Tabs>
  );
}
