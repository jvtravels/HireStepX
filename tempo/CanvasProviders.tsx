/* Minimal CanvasProviders.
   The design-system canvas is fully self-contained (no Router / Redux /
   Auth context needed). This wrapper just provides a clean surface that
   re-declares the brand tokens as CSS custom properties so any nested
   component sees them. */
import React from "react";

export default function CanvasProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        {
          minHeight: "100vh",
          width: "100%",
          background: "#FAF7F0",
          color: "#0E0C08",
          fontFamily: "'Satoshi', -apple-system, system-ui, sans-serif",
          fontSize: 16,
          lineHeight: 1.55,
          // Brand tokens — duplicated here so canvas components can use var(--*)
          "--cream": "#FAF7F0",
          "--white": "#FFFFFF",
          "--cream-soft": "#F4EFE3",
          "--coal": "#0E0C08",
          "--indigo-gray": "#3E3A6E",
          "--ink-soft": "#6E6759",
          "--ink-faint": "#A39C8B",
          "--indigo": "#312E81",
          "--indigo-deep": "#1E1B4B",
          "--indigo-100": "#E5E2F2",
          "--indigo-ring": "rgba(49, 46, 129, 0.20)",
          "--copper": "#B45309",
          "--copper-soft": "rgba(180, 83, 9, 0.12)",
          "--copper-100": "#F4E5D8",
          "--error": "#B91C1C",
          "--error-100": "#FEE2E2",
          "--success": "#15803D",
          "--success-100": "#DCFCE7",
          "--line": "#EBE5D2",
          "--line-strong": "#D6CDB5",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
