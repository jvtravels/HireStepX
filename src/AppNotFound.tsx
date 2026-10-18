import Link from "next/link";
import { tokens as t, fonts as f } from "./auth/_tokens";

export default function AppNotFound() {
  const btn = { fontFamily: f.sans, fontSize: 14, fontWeight: 500, padding: "10px 20px", borderRadius: 8, textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, textAlign: "center", color: t.coal, fontFamily: f.sans }}>
      <p style={{ fontFamily: f.mono, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 12px" }}>404</p>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>We can&rsquo;t find that page</h1>
      <p style={{ fontSize: 14, color: t.inkSoft, margin: "0 0 24px", maxWidth: 420, lineHeight: 1.6 }}>
        The link may be old or mistyped. Pick up where you left off instead.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/dashboard" style={{ ...btn, color: t.white, background: t.indigo }}>Go to dashboard</Link>
        <Link href="/sessions" style={{ ...btn, color: t.coal, background: t.white, border: `1px solid ${t.line}` }}>My sessions</Link>
      </div>
    </div>
  );
}
