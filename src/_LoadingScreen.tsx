import Image from "next/image";
import { tokens as t, fonts as f } from "./auth/_tokens";

/* The one loading animation for the whole product — every route
   loading.tsx, dynamic-import fallback, and full-page/full-section
   "waiting on the server" state renders this instead of a bespoke
   spinner/skeleton, so a user never sees two different loading
   treatments in the same session.

   `fullScreen` (default true) covers the page itself, e.g. a route's
   loading.tsx. Pass `false` when embedding inside a shell that already
   owns the page background/min-height (e.g. a results page with its
   own back button above the loading state) — it then just centers in
   whatever space its parent gives it. `title`/`footer` are optional
   for screens that want more context than a single message line. */
export default function LoadingScreen({
  message,
  title,
  footer,
  fullScreen = true,
}: {
  message?: string;
  title?: string;
  footer?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: fullScreen ? "100vh" : undefined,
        background: fullScreen ? t.cream : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: fullScreen ? undefined : "80px 20px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <div
          style={{
            width: 56,
            height: 56,
            border: `3px solid ${t.copper100}`,
            borderTopColor: t.copper,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 24px",
          }}
        />
        <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} style={{ display: "block", height: 30, width: "auto", margin: "0 auto" }} priority />
        {title && (
          <h1 style={{ marginTop: 24, fontSize: 28, color: t.coal, fontWeight: 400, letterSpacing: "-0.02em" }}>{title}</h1>
        )}
        {message && (
          <p style={{ marginTop: 14, fontSize: 13, color: t.inkFaint, fontFamily: f.sans }}>{message}</p>
        )}
        {footer && (
          <p style={{ marginTop: 20, fontSize: 12, color: t.inkFaint, fontFamily: f.sans }}>{footer}</p>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span className="sr-only">{title || message || "Loading..."}</span>
    </div>
  );
}
