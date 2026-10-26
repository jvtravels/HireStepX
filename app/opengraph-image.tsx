import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HireStepX: prepare to be hired. Hire the prepared.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INDIGO = "#2f2b77";
const INK = "#14131f";
const INK_SOFT = "#4b4a5e";
const WASH = "#f6f5fb";
const LINE = "#e3e1f0";
const ORANGE = "#e2552c";

const frame = { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 80px", background: WASH, backgroundImage: "radial-gradient(ellipse 60% 60% at 90% 0%, rgba(47, 43, 119, 0.12) 0%, transparent 70%)" } as const;
const row = { display: "flex", alignItems: "center" } as const;
const wordmark = { display: "flex", fontSize: 34, fontWeight: 700, color: INK, letterSpacing: "-0.02em" } as const;
const headline = { display: "flex", flexDirection: "column", fontSize: 104, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.035em", color: INK } as const;
const line2 = { display: "flex" } as const;
const lede = { display: "flex", marginTop: 28, fontSize: 28, lineHeight: 1.4, color: INK_SOFT, maxWidth: 1040 } as const;
const footer = { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 28, borderTop: `2px solid ${LINE}`, fontSize: 24, color: INK_SOFT } as const;
const cta = { display: "flex", padding: "14px 28px", borderRadius: 14, background: INDIGO, color: "white", fontSize: 24, fontWeight: 700 } as const;

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={frame}>
        <div style={row}>
          <div style={wordmark}>
            HireStep<span style={{ color: ORANGE }}>X</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={headline}>
            <div style={line2}>
              Prepare to be&nbsp;<span style={{ color: INDIGO }}>hired.</span>
            </div>
            <div style={line2}>
              Hire the&nbsp;<span style={{ color: INDIGO }}>prepared.</span>
            </div>
          </div>
          <div style={lede}>AI mock interviews for India. Speak your answers, get a scored report.</div>
        </div>
        <div style={footer}>
          <div style={row}>hirestepx.com&nbsp;&nbsp;·&nbsp;&nbsp;STAR scoring&nbsp;&nbsp;·&nbsp;&nbsp;2 free sessions</div>
          <div style={cta}>Start practising</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
