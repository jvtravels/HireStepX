"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "hsx_beta_banner_dismissed";

export function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="banner"
      style={{
        position: "relative",
        zIndex: 1,
        background: "#B45309",
        color: "#FAF7F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "9px 48px 9px 16px",
        fontSize: 13,
        fontFamily: "var(--font-ui, system-ui, sans-serif)",
        fontWeight: 500,
        lineHeight: 1.4,
        textAlign: "center",
      }}
    >
      <span>
        HireStepX is now in Beta! Be among the first to practice smarter and land your dream role.{" "}
        <a
          href="mailto:hello@hirestepx.com"
          style={{
            color: "#FAF7F0",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            fontWeight: 700,
          }}
        >
          Share your feedback
        </a>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss beta banner"
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          color: "#FAF7F0",
          cursor: "pointer",
          padding: "4px 6px",
          fontSize: 16,
          lineHeight: 1,
          opacity: 0.8,
        }}
      >
        ×
      </button>
    </div>
  );
}
