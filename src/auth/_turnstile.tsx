/* HireStepX — Cloudflare Turnstile widget
   Invisible / managed CAPTCHA used on signup + forgot-password. The
   site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY) is public; the secret key
   lives in the server handler that calls /siteverify. */
"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "auto" | "light" | "dark";
          size?: "normal" | "compact" | "invisible" | "flexible";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
  }
}

let scriptLoaded = false;
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("no document"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_URL}"]`,
    );
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  /** Called whenever a fresh token is issued (or refreshed). */
  onToken: (token: string) => void;
  /** Called when the challenge errors out. */
  onError?: () => void;
  /** Called when the issued token expires before submission. */
  onExpired?: () => void;
  /** "invisible" runs without UI; "flexible" shows a checkbox-style box. */
  size?: "invisible" | "flexible";
}

/** Renders a Turnstile widget. If NEXT_PUBLIC_TURNSTILE_SITE_KEY is
    missing (dev / preview without the env var set), this component
    renders nothing AND immediately calls onToken("") so the parent
    form doesn't block waiting for a token. Server-side verification
    will gracefully accept empty tokens in dev mode (see _shell.ts). */
export default function TurnstileWidget({
  onToken,
  onError,
  onExpired,
  size = "invisible",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    // Dev / preview without site key → no-op + grant empty token.
    if (!SITE_KEY) {
      onToken("");
      return;
    }
    setStatus("loading");
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: SITE_KEY,
            size,
            appearance: size === "invisible" ? "execute" : "always",
            callback: (token) => onToken(token),
            "error-callback": () => onError?.(),
            "expired-callback": () => onExpired?.(),
          });
          setStatus("ready");
        } catch {
          setStatus("error");
          onError?.();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        onError?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
    };
    // Intentionally only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return (
    <div
      ref={containerRef}
      data-turnstile-status={status}
      // Invisible widgets render at zero size; flexible takes its
      // natural Cloudflare-supplied dimensions.
      style={{
        marginTop: size === "invisible" ? 0 : 12,
        display: size === "invisible" ? "none" : "block",
      }}
    />
  );
}
