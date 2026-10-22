"use client";

/* Shared search-bar behavior — the SearchInput box plus an on-focus
   dropdown of recent searches (persisted per-browser via localStorage,
   see useRecentSearches) and optional suggested-filter chips. Extracted
   from the employer /jobs console so every search surface in the app
   (candidate jobs, sessions, admin, employer candidates, marketing
   search) shares the same behavior, not just the same input styling. */

import { useRef, useState } from "react";
import { ClockIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { SearchInput } from "@/components/SearchInput";
import { useRecentSearches } from "@/useRecentSearches";

export interface SuggestedFilter {
  label: string;
  apply: () => void;
}

export function SearchWithSuggestions({
  id,
  label,
  value,
  onChange,
  placeholder,
  storageKey,
  suggestedFilters = [],
  style,
  inputStyle,
  inputClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  storageKey: string;
  suggestedFilters?: SuggestedFilter[];
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  inputClassName?: string;
}) {
  const { recentSearches, commitSearch } = useRecentSearches(storageKey);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapRef} style={{ position: "relative", ...style }}>
      <SearchInput
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { commitSearch(value); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder={placeholder}
        inputStyle={inputStyle}
        inputClassName={inputClassName}
      />
      {focused && (recentSearches.length > 0 || suggestedFilters.length > 0) && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
            background: t.white, border: `1px solid ${t.line}`, borderRadius: 10,
            boxShadow: "0px 8px 24px rgba(20, 20, 43, 0.12)", padding: "12px 4px",
            maxHeight: 320, overflowY: "auto",
          }}
        >
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: suggestedFilters.length > 0 ? 10 : 0 }}>
              <div style={{ padding: "0 12px 6px", fontFamily: f.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: t.inkFaint, textTransform: "uppercase" }}>
                Recent searches
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(term); commitSearch(term); setFocused(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: f.sans, fontSize: textSize.base, color: t.coal, borderRadius: 6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <ClockIcon size={13} color={t.inkFaint} aria-hidden="true" />
                  {term}
                </button>
              ))}
            </div>
          )}
          {suggestedFilters.length > 0 && (
            <div>
              <div style={{ padding: "0 12px 6px", fontFamily: f.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: t.inkFaint, textTransform: "uppercase" }}>
                Suggested filters
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px" }}>
                {suggestedFilters.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); s.apply(); setFocused(false); }}
                    style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${t.line}`, background: t.white, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 500, color: t.coal, cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = t.white; }}
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
