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
      <div style={{ textAlign: "center", width: "100%", maxWidth: 420 }}>
        <div className="skeleton skeleton-heading" style={{ width: "55%", margin: "0 auto 14px" }} />
        <div className="skeleton skeleton-text" style={{ width: "92%", margin: "0 auto 10px" }} />
        <div className="skeleton skeleton-text" style={{ width: "68%", margin: "0 auto" }} />
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
      <span className="sr-only">{title || message || "Loading..."}</span>
    </div>
  );
}
