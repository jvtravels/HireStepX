"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { Wordmark } from "./auth/_fields";

const WRAP_STYLE = { justifySelf: "start", display: "flex", alignItems: "center", gap: 12, minWidth: 0 } as const;
const LOGO_STYLE = { textDecoration: "none", display: "inline-flex" } as const;
const BACK_STYLE = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 8, fontFamily: F.sans, fontSize: 14, fontWeight: 500, color: T.inkSoft } as const;

export default function SetupTopbarLeft() {
  const router = useRouter();
  return (
    <div style={WRAP_STYLE}>
      <Link href="/dashboard" aria-label="HireStepX, go to dashboard" style={LOGO_STYLE}>
        <Wordmark />
      </Link>
      {/* history.length is 1 when the page was opened directly, where back() would leave the app. */}
      <button type="button" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/dashboard"); }} style={BACK_STYLE}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
        Back
      </button>
    </div>
  );
}
