import type { CSSProperties } from "react";
import { tokens as t, fonts as f } from "./auth/_tokens";

/* The one loading treatment for the whole product — every route
   loading.tsx, dynamic-import fallback, and full-page/full-section
   "waiting on the server" state renders this instead of a bespoke
   spinner, so a user never sees two different loaders in one session:
   the HireStepX wordmark over a copper ring.

   `fullScreen` (default true) covers the page itself and shows the
   wordmark. Pass `false` when embedding inside a shell that already
   owns the page background/min-height (e.g. a results page with its
   own back button above the loading state): it then shows just the ring,
   centered in whatever space its parent gives it. `title`/`footer` are
   optional for screens that want more context than a single message line.
   Screens with a known layout should prefer a shaped skeleton
   (src/routeSkeletons.tsx); this is the fallback when there isn't one.
   The `spin` keyframes are frozen by the global prefers-reduced-motion rule. */

const ring: CSSProperties = {
  width: 40,
  height: 40,
  boxSizing: "border-box",
  borderRadius: "50%",
  border: `3px solid ${t.copperMid}`,
  borderTopColor: t.copper,
  animation: "spin 0.9s linear infinite",
};

const frame: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 };
const fullFrame: CSSProperties = { ...frame, minHeight: "100vh", background: t.cream };
const inlineFrame: CSSProperties = { ...frame, padding: "80px 20px" };
const wordmark: CSSProperties = { height: 32, width: "auto", display: "block" };
const note: CSSProperties = { margin: 0, fontSize: 13, color: t.inkFaint, fontFamily: f.sans, textAlign: "center" };

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
    <div role="status" aria-live="polite" aria-busy="true" style={fullScreen ? fullFrame : inlineFrame}>
      {fullScreen && <img src="/wordmark.png" alt="" style={wordmark} />}
      <div aria-hidden="true" style={ring} />
      {title && (
        <h1 style={{ margin: 0, fontSize: 28, color: t.coal, fontWeight: 400, letterSpacing: "-0.02em", textAlign: "center" }}>{title}</h1>
      )}
      {message && <p style={note}>{message}</p>}
      {footer && <p style={{ ...note, fontSize: 12 }}>{footer}</p>}
      <span className="sr-only">{title || message || "Loading..."}</span>
    </div>
  );
}
