import { ImageResponse } from "next/og";
import { getSeoPageBySlug, getAllSeoSlugs } from "../../../../data/seo-pages";
import { COMPANY_LABEL } from "../../../../data/company-labels";

// Not edge runtime — seo-pages.ts bundle exceeds 1 MB edge limit.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Metadata image routes under a dynamic segment don't inherit the sibling
   page.tsx's generateStaticParams — without their own, Next can't resolve
   slugs for this route and 404s even though /questions/[slug] itself is a
   live 200. Confirmed on prod via GSC + curl. */
export async function generateStaticParams() {
  return getAllSeoSlugs().map((slug) => ({ slug }));
}

const COAL = "#0E0C08";
const CREAM = "#FAF7F0";
const COPPER = "#B45309";
const INK_SOFT = "#6E6759";
const LINE = "#EBE5D2";

const FOCUS_LABEL: Record<string, string> = {
  behavioral: "Behavioural",
  technical: "Technical",
  "system-design": "System Design",
  "case-study": "Case Study",
  "campus-placement": "Campus Placement",
  hr: "HR Round",
  panel: "Panel Interview",
  "salary-negotiation": "Salary Negotiation",
  leadership: "Leadership",
  general: "General",
  management: "Management",
  "government-psu": "Government / PSU",
  strategic: "Strategic",
};

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);

  const companyLabel = page ? (COMPANY_LABEL[page.company] ?? page.company) : "HireStepX";
  const focusLabel = page ? (FOCUS_LABEL[page.focus] ?? page.focus) : "Interview";
  const headline = page ? page.searchPhrase : "Interview Questions";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: CREAM,
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 90% 10%, rgba(180, 83, 9, 0.12) 0%, transparent 65%)",
        }}
      >
        {/* Wordmark + focus badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: COAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: CREAM,
              fontFamily: "serif",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            H
          </div>
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: COAL,
              letterSpacing: "-0.01em",
            }}
          >
            HireStepX
          </div>
          <div
            style={{
              marginLeft: 16,
              padding: "4px 14px",
              borderRadius: 999,
              border: `1px solid ${LINE}`,
              fontFamily: "sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: COPPER,
              letterSpacing: "0.05em",
              display: "flex",
            }}
          >
            {focusLabel.toUpperCase()}
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: COPPER,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {companyLabel}
          </div>
          <div
            style={{
              fontFamily: "serif",
              fontSize: headline.length > 50 ? 58 : 72,
              lineHeight: 1.05,
              letterSpacing: "-0.022em",
              color: COAL,
              maxWidth: 880,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 26,
              lineHeight: 1.4,
              color: INK_SOFT,
              maxWidth: 720,
              display: "flex",
            }}
          >
            Curated questions from real candidate interviews. Practice with AI voice feedback.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: `1px solid ${LINE}`,
            fontFamily: "sans-serif",
            fontSize: 18,
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex", gap: 20 }}>
            <span>hirestepx.com/questions</span>
            <span style={{ color: "#A39C8B" }}>·</span>
            <span>STAR scoring</span>
            <span style={{ color: "#A39C8B" }}>·</span>
            <span>Voice AI</span>
          </div>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              background: COAL,
              color: CREAM,
              fontWeight: 600,
              fontSize: 17,
              display: "flex",
            }}
          >
            2 sessions free →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
