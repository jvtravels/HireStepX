import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentSearches } from "../useRecentSearches";

describe("useRecentSearches", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty when nothing is stored", () => {
    const { result } = renderHook(() => useRecentSearches("test-key"));
    expect(result.current.recentSearches).toEqual([]);
  });

  it("loads previously persisted searches for its storage key", () => {
    window.localStorage.setItem("test-key", JSON.stringify(["java developer", "remote"]));
    const { result } = renderHook(() => useRecentSearches("test-key"));
    expect(result.current.recentSearches).toEqual(["java developer", "remote"]);
  });

  it("commits a new search to the front of the list and persists it", () => {
    const { result } = renderHook(() => useRecentSearches("test-key"));
    act(() => result.current.commitSearch("product manager"));
    expect(result.current.recentSearches).toEqual(["product manager"]);
    expect(JSON.parse(window.localStorage.getItem("test-key") || "[]")).toEqual(["product manager"]);
  });

  it("ignores blank/whitespace-only commits", () => {
    const { result } = renderHook(() => useRecentSearches("test-key"));
    act(() => result.current.commitSearch("   "));
    expect(result.current.recentSearches).toEqual([]);
  });

  it("de-duplicates case-insensitively, moving the repeat to the front", () => {
    const { result } = renderHook(() => useRecentSearches("test-key"));
    act(() => result.current.commitSearch("Backend Engineer"));
    act(() => result.current.commitSearch("Data Analyst"));
    act(() => result.current.commitSearch("backend engineer"));
    expect(result.current.recentSearches).toEqual(["backend engineer", "Data Analyst"]);
  });

  it("caps the list at 5 entries, dropping the oldest", () => {
    const { result } = renderHook(() => useRecentSearches("test-key"));
    for (const term of ["a", "b", "c", "d", "e", "f"]) {
      act(() => result.current.commitSearch(term));
    }
    expect(result.current.recentSearches).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("keeps separate histories per storage key", () => {
    const jobs = renderHook(() => useRecentSearches("jobs-key"));
    const sessions = renderHook(() => useRecentSearches("sessions-key"));
    act(() => jobs.result.current.commitSearch("frontend"));
    act(() => sessions.result.current.commitSearch("behavioral"));
    expect(jobs.result.current.recentSearches).toEqual(["frontend"]);
    expect(sessions.result.current.recentSearches).toEqual(["behavioral"]);
  });

  it("tolerates corrupted localStorage content", () => {
    window.localStorage.setItem("test-key", "{not json");
    const { result } = renderHook(() => useRecentSearches("test-key"));
    expect(result.current.recentSearches).toEqual([]);
  });

  it("ignores a non-array JSON value in storage", () => {
    window.localStorage.setItem("test-key", JSON.stringify({ not: "an array" }));
    const { result } = renderHook(() => useRecentSearches("test-key"));
    expect(result.current.recentSearches).toEqual([]);
  });

  it("filters out non-string entries from stored data", () => {
    window.localStorage.setItem("test-key", JSON.stringify(["valid", 42, null, "also valid"]));
    const { result } = renderHook(() => useRecentSearches("test-key"));
    expect(result.current.recentSearches).toEqual(["valid", "also valid"]);
  });
});
