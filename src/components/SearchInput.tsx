"use client";

/* Shared search-with-icon input — the base input rendered by
   SearchWithSuggestions (recent-searches dropdown, used across the
   candidate dashboard) and used directly by the employer requirement
   detail candidates table, so every search box in the app looks the same. */

import { SearchIcon } from "lucide-react";
import { tokens as T } from "@/auth/_tokens";
import { Input } from "@/components/ui/input";

export function SearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  style,
  inputStyle,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <SearchIcon
        size={14}
        color={T.inkFaint}
        aria-hidden="true"
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
      />
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={{ paddingLeft: 34, height: 36, width: "100%", ...inputStyle }}
      />
    </div>
  );
}
