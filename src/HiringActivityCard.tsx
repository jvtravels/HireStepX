"use client";

/* Dashboard rail card — the candidate-facing half of the employer talent-
   roster feature. Settings → "Visible to employers" turns matching on;
   this card is where a candidate actually sees the effect of that toggle
   (shortlisted / contacted counts, recent activity) instead of it being an
   invisible backend flag. Fetches /api/candidate-hiring-activity, which
   returns { discoverable: false } immediately for anyone who hasn't opted
   in, so this renders a lightweight nudge rather than empty data. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "./supabase";
import { tokens as t, fonts as f } from "./auth/_tokens";

interface HiringActivity {
  discoverable: boolean;
  shortlistedCount?: number;
  unlockedCount?: number;
  recent?: Array<{ roleTitle: string; companyName: string; location: string; unlocked: boolean; matchedAt: string }>;
}

export default function HiringActivityCard() {
  const router = useRouter();
  const [data, setData] = useState<HiringActivity | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/candidate-hiring-activity", { headers });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json) setData(json as HiringActivity);
      } catch {
        // stay quiet on transient failure — this is a nice-to-have, not core flow
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  const boxStyle: React.CSSProperties = {
    padding: "16px",
    background: t.creamSoft,
    border: `1px solid ${t.line}`,
    borderRadius: 10,
  };

  if (!data.discoverable) {
    return (
      <div style={boxStyle}>
        <p style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: 0.5, color: t.inkSoft, margin: "0 0 6px", textTransform: "uppercase" }}>
          Hiring activity
        </p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: "0 0 10px", lineHeight: 1.5 }}>
          Turn on "Visible to employers" in Settings to let companies on our talent roster match you to open roles.
        </p>
        <button
          type="button"
          onClick={() => router.push("/settings")}
          style={{
            padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.lineStrong}`,
            background: "transparent", color: t.coal, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}
        >
          Open Settings
        </button>
      </div>
    );
  }

  const shortlisted = data.shortlistedCount ?? 0;
  const unlocked = data.unlockedCount ?? 0;

  return (
    <div style={boxStyle}>
      <p style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: 0.5, color: t.inkSoft, margin: "0 0 10px", textTransform: "uppercase" }}>
        Hiring activity
      </p>

      {shortlisted === 0 ? (
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
          You're visible to employers. No matches yet — we'll surface this the moment a role fits your profile.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal, lineHeight: 1 }}>{shortlisted}</div>
              <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkSoft, marginTop: 2 }}>Shortlisted for</div>
            </div>
            <div>
              <div style={{ fontFamily: f.serif, fontSize: 24, color: t.coal, lineHeight: 1 }}>{unlocked}</div>
              <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkSoft, marginTop: 2 }}>Contacted you</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.recent || []).slice(0, 4).map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.coal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.roleTitle}
                  </div>
                  <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkFaint }}>
                    {r.companyName}{r.location ? ` · ${r.location}` : ""}
                  </div>
                </div>
                {r.unlocked && (
                  <span style={{
                    flexShrink: 0, fontFamily: f.mono, fontSize: 10, letterSpacing: 0.4, color: t.indigoDeep,
                    background: t.indigo100, padding: "3px 8px", borderRadius: 999,
                  }}>
                    CONTACTED
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
