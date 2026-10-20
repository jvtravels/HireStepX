import Link from "next/link";
import { tokens as t, fonts as f } from "./auth/_tokens";

const S_WRAP = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, textAlign: "center", color: t.coal, fontFamily: f.sans } as const;
const S_CODE = { fontFamily: f.mono, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 12px" } as const;
const S_H1 = { fontSize: 22, fontWeight: 600, margin: "0 0 8px" } as const;
const S_P = { fontSize: 14, color: t.inkSoft, margin: "0 0 24px", maxWidth: 420, lineHeight: 1.6 } as const;
const S_ROW = { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" } as const;
const S_BTN = { fontFamily: f.sans, fontSize: 14, fontWeight: 500, padding: "10px 20px", borderRadius: 8, textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" } as const;
const S_PRIMARY = { ...S_BTN, color: t.white, background: t.indigo } as const;
const S_SECONDARY = { ...S_BTN, color: t.coal, background: t.white, border: `1px solid ${t.line}` } as const;

export default function AppNotFound() {
  return (
    <div style={S_WRAP}>
      <p style={S_CODE}>404</p>
      <h1 style={S_H1}>We can&rsquo;t find that page</h1>
      <p style={S_P}>
        The link may be old or mistyped. Pick up where you left off instead.
      </p>
      <div style={S_ROW}>
        <Link href="/dashboard" style={S_PRIMARY}>Go to dashboard</Link>
        <Link href="/sessions" style={S_SECONDARY}>My sessions</Link>
      </div>
    </div>
  );
}
