"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candidate } from "@/employer/mockData";
import { candidateDisplayName } from "./requirementFormat";
import { MAX_SELECTION, idsBetween, pruneSelection, setChecked, setManyChecked } from "./shortlistSelection";
import { rowAnnouncement } from "./useShortlistShortcuts";

interface Options {
  /** Everything the current tab, search and filters show, across all pages. */
  filtered: readonly Candidate[];
  /** The rows on the page being shown. */
  pageRows: readonly Candidate[];
  onOpen: (id: string) => void;
}

const LIMIT_NOTE = `You can select up to ${MAX_SELECTION} candidates at a time.`;

/** Selection, the keyboard cursor and the screen-reader announcements for the shortlist table. The selection only
    ever holds candidates the current view shows, so a bulk action can never reach a row the employer can't see. */
export function useShortlistSelection({ filtered, pageRows, onOpen }: Options) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const anchorId = useRef<string | null>(null);

  const selected = useMemo(() => pruneSelection(chosen, filtered), [chosen, filtered]);
  // Narrowing the view drops what it hides, and says so, instead of leaving them selected out of sight.
  useEffect(() => {
    if (selected === chosen) return;
    setChosen(selected);
    const hidden = chosen.size - selected.size;
    setAnnouncement(`${hidden} selected candidate${hidden === 1 ? " is" : "s are"} no longer in this view, so they were deselected.`);
  }, [selected, chosen]);

  // A cursor left on a row that paging or filtering removed would make x do nothing.
  useEffect(() => {
    if (activeId && !pageRows.some((c) => c.id === activeId)) setActiveId(null);
  }, [pageRows, activeId]);

  const offPage = useMemo(() => {
    const onPage = new Set(pageRows.map((c) => c.id));
    let n = 0;
    for (const id of selected) if (!onPage.has(id)) n += 1;
    return n;
  }, [selected, pageRows]);

  const commit = useCallback((result: { next: Set<string>; capped: number }) => {
    setChosen(result.next);
    if (result.capped > 0) setAnnouncement(LIMIT_NOTE);
  }, []);

  const toggle = useCallback((c: Candidate, checked: boolean, range = false) => {
    const anchor = anchorId.current;
    if (range && anchor && anchor !== c.id) {
      const ids = idsBetween(pageRows, anchor, c.id);
      if (ids.length > 0) {
        commit(setManyChecked(selected, ids, checked));
        anchorId.current = c.id;
        return;
      }
    }
    const { next, capped } = setChecked(selected, c.id, checked);
    commit({ next, capped: capped ? 1 : 0 });
    anchorId.current = c.id;
  }, [pageRows, selected, commit]);

  const pageIds = useMemo(() => pageRows.map((c) => c.id), [pageRows]);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const pageState: "none" | "some" | "all" = pageSelected === 0 ? "none" : pageSelected === pageIds.length ? "all" : "some";
  const togglePage = useCallback(() => {
    // With the limit reached, a partly selected page can only be cleared, not filled.
    const clear = pageState === "all" || (pageState === "some" && selected.size >= MAX_SELECTION);
    commit(setManyChecked(selected, pageIds, !clear));
  }, [pageState, selected, pageIds, commit]);

  const deselect = useCallback((ids: readonly string[]) => {
    setChosen((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
  }, []);
  const clear = useCallback(() => setChosen(new Set()), []);

  const moveActive = useCallback((step: 1 | -1) => {
    if (pageRows.length === 0) return;
    const at = pageRows.findIndex((c) => c.id === activeId);
    const index = at === -1 ? (step === 1 ? 0 : pageRows.length - 1) : Math.min(pageRows.length - 1, Math.max(0, at + step));
    const row = pageRows[index];
    setActiveId(row.id);
    setAnnouncement(rowAnnouncement(candidateDisplayName(row), index + 1, pageRows.length, selected.has(row.id)));
  }, [pageRows, activeId, selected]);
  const next = useCallback(() => moveActive(1), [moveActive]);
  const prev = useCallback(() => moveActive(-1), [moveActive]);

  const toggleActive = useCallback(() => {
    const row = pageRows.find((c) => c.id === activeId);
    if (!row) {
      setAnnouncement("No candidate is focused. Press j to move to one.");
      return;
    }
    const nowSelected = !selected.has(row.id);
    const { next: after, capped } = setChecked(selected, row.id, nowSelected);
    commit({ next: after, capped: capped ? 1 : 0 });
    anchorId.current = row.id;
    setAnnouncement(capped ? LIMIT_NOTE : `${candidateDisplayName(row)} ${nowSelected ? "selected" : "not selected"}`);
  }, [pageRows, activeId, selected, commit]);

  const openActive = useCallback(() => {
    if (activeId) onOpen(activeId);
  }, [activeId, onOpen]);

  return { selected, offPage, activeId, announcement, toggle, togglePage, pageState, deselect, clear, next, prev, toggleActive, openActive };
}
