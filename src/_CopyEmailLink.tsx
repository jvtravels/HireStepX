"use client";

/* Inline email address that copies to clipboard on click.
 * Replaces mailto: links site-wide so clicking an email never hijacks
 * the user's default mail client. Shows a brief "Copied!" confirmation
 * in place of the label, then resets after 2 s. */

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface CopyEmailLinkProps {
  email: string;
  /** Visible label; defaults to the email address itself. */
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function CopyEmailLink({ email, children, style, className }: CopyEmailLinkProps) {
  const [copied, setCopied] = useState(false);
  const visibleLabel = typeof children === "string" ? children : email;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* silent */ }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(fallback);
    } else {
      fallback();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Copied!" : `Click to copy ${email}`}
      aria-label={copied ? "Email address copied" : `${visibleLabel}: copy email address ${email}`}
      className={className}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        textUnderlineOffset: "2px",
        display: "inline",
        ...style,
        ...(copied ? { textDecorationStyle: "solid" } : {}),
      }}
    >
      {copied ? "Copied!" : (children ?? email)}
    </button>
  );
}
