"use client";

import { useEffect, useState } from "react";

const MAX_RECENT_SEARCHES = 5;

function load(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

function save(storageKey: string, list: string[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // best-effort — private browsing / blocked storage just means no persistence
  }
}

/** Per-browser recent-search history, scoped by `storageKey` so each search
    surface (jobs, sessions, candidates, ...) keeps its own list. */
export function useRecentSearches(storageKey: string) {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => { setRecentSearches(load(storageKey)); }, [storageKey]);

  const commitSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      save(storageKey, next);
      return next;
    });
  };

  return { recentSearches, commitSearch };
}
