import Image from "next/image";
import { tokens as t, fonts as f } from "./auth/_tokens";

/* The one full-page loading screen for the whole product — every route
   loading.tsx, dynamic-import fallback, and full-screen "waiting on the
   server" state renders this instead of a bespoke spinner/skeleton, so a
   user never sees two different loading treatments in the same session. */
export default function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "100vh",
        background: t.cream,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
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
        <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} style={{ height: 30, width: "auto" }} priority />
        {message && (
          <p style={{ marginTop: 14, fontSize: 13, color: t.inkFaint, fontFamily: f.sans }}>{message}</p>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span className="sr-only">{message || "Loading..."}</span>
    </div>
  );
}
