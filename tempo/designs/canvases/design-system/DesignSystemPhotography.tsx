/* HireStepX — Design System / Photography & Imagery
   When to use photos. When to skip. The visual language for marketing,
   testimonials, and the surfaces that need a human face. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* "Photo" mockup — since we can't load real images in canvas, we render a
   stylized placeholder that conveys the treatment. Think of these as
   stand-ins for what a real photo would look like. */
function PhotoPlaceholder({
  warm,
  height = 280,
  treatment,
  caption,
}: {
  warm?: boolean;
  height?: number;
  treatment: string;
  caption: string;
}) {
  // Simulate a photo with a gradient that matches the warmth/coolness rule
  const bg = warm
    ? "linear-gradient(135deg, #E8C9A8 0%, #C49872 50%, #8E5F3D 100%)"
    : "linear-gradient(135deg, #B8C5D8 0%, #6F7C92 50%, #2F3B4F 100%)";
  return (
    <div
      style={{
        background: bg,
        height,
        borderRadius: 10,
        position: "relative",
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {/* Simulate a subject silhouette */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 80,
          height: 100,
          background: "rgba(0,0,0,0.18)",
          borderRadius: "50% 50% 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: "50%",
          transform: "translateX(-50%)",
          width: 56,
          height: 56,
          background: "rgba(0,0,0,0.22)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          fontFamily: f.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: warm ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.85)",
        }}
      >
        {treatment}
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function DesignSystemPhotography() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* MASTHEAD */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 40, marginBottom: 64 }}>
          <MonoLabel>Design System · v1.0</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "12px 0 0",
            }}
          >
            Photography, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>restraint</em>.
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 15,
              margin: "16px 0 0",
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            The product is image-free. Marketing, testimonials, and the
            founder's About page are where photos live. Real over stock. Warm
            over cool. A face you'd recognize, not a face from Adobe Stock.
          </p>
        </header>

        {/* 01 — WHEN TO USE / NOT USE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="When to use photos · when not to"
            desc="The decision matrix. Most surfaces don't need a photo. The ones that do, need a real one."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderLeft: `3px solid ${t.success}`,
                borderRadius: 10,
                padding: "28px 32px",
              }}
            >
              <MonoLabel color={t.success}>Use photography</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {[
                  "Testimonial cards · the user's real face with their permission",
                  "Founder About page · a candid portrait, not a corporate headshot",
                  "Blog post heroes · contextual to the topic, not stock decoration",
                  "Press kit · founder + product screenshots",
                  "Social media campaigns · real candidates, real moments",
                  "Career page · the team, working",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 14,
                      color: t.indigoGray,
                      lineHeight: 1.55,
                      paddingLeft: 16,
                      position: "relative",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, color: t.success, fontWeight: 600 }}>
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderLeft: `3px solid ${t.error}`,
                borderRadius: 10,
                padding: "28px 32px",
              }}
            >
              <MonoLabel color={t.error}>Avoid photography</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {[
                  "Auth screens · the editorial type does the work",
                  "Dashboard · data + UI is the visual interest",
                  "Onboarding · forms and progress, not faces",
                  "Pricing · pricing tables, not happy-people photos",
                  "Empty states · illustrations or icons only",
                  "Error states · type + icon, never decorative",
                  "Email transactional · slow load, often blocked",
                  "Generic 'happy professionals shaking hands' stock — ever",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 14,
                      color: t.indigoGray,
                      lineHeight: 1.55,
                      paddingLeft: 16,
                      position: "relative",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, color: t.error, fontWeight: 600 }}>
                      ×
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 02 — TONE & TREATMENT */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Tone & treatment"
            desc="The visual treatment that makes a photo feel like ours, not anyone else's."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: shadows.card,
              }}
            >
              <PhotoPlaceholder warm treatment="Warm · ours" caption="" />
              <MonoLabel color={t.success}>Do · warm tones</MonoLabel>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: "12px 0 0", lineHeight: 1.6 }}>
                Slight warm cast (+200 Kelvin from neutral). Sits naturally on
                cream backgrounds. Skin tones lean honey, not pink. Natural
                light, not studio strobes. Reads as "made for HireStepX."
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: shadows.card,
              }}
            >
              <PhotoPlaceholder treatment="Cool · not ours" caption="" />
              <MonoLabel color={t.error}>Don't · cool blue</MonoLabel>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: "12px 0 0", lineHeight: 1.6 }}>
                Corporate stock signature. Blue cast clashes with cream
                background. Skin tones go ashen. Reads as "every other SaaS."
                Avoid on principle.
              </p>
            </div>
          </div>
        </section>

        {/* 03 — APPROACH */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Approach"
            desc="Six guiding principles. Apply to every shoot, every selection, every crop."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 18 }}>
              {[
                {
                  k: "Real, not stock",
                  v: "Always shoot or commission. Stock is detectable in 1.2 seconds. The premium brands you admire (Mercury, Stripe Atlas, Substack) never use stock — and neither do we.",
                },
                {
                  k: "Candid, not posed",
                  v: "Mid-action, mid-thought, mid-laugh. Eye contact with the camera kills the editorial feel. We want the photo to feel observed, not performed.",
                },
                {
                  k: "Indian faces",
                  v: "Our market is India. Photos should reflect that. A diverse range — fresher, mid-career, older returner — but unmistakably Indian context. Not generic global.",
                },
                {
                  k: "Natural light",
                  v: "Window light, golden hour, soft daylight. No ring lights, no studio strobes, no aggressive product photography. The brand reads as warm; the lighting must too.",
                },
                {
                  k: "Negative space",
                  v: "Compose with breathing room. Subject takes 30-50% of the frame, not 90%. Allows for type overlay and matches our editorial whitespace philosophy.",
                },
                {
                  k: "One subject",
                  v: "When in doubt, one person, not three. Group photos read as 'team page'. Individual portraits read as 'this is a real human, with a real story.'",
                },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}
                >
                  <span
                    style={{
                      fontFamily: f.serif,
                      fontSize: 18,
                      color: t.copper,
                      fontWeight: 500,
                      paddingTop: 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ color: t.indigoGray }}>{row.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 04 — CROP & COMPOSITION */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Crop & composition"
            desc="Four standard crop ratios. One rule: subject left or right of center, never dead-center."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {[
              {
                ratio: "16:9",
                use: "Landing hero · blog hero",
                w: 320,
                h: 180,
              },
              {
                ratio: "4:5",
                use: "Social post (Instagram, LinkedIn)",
                w: 240,
                h: 300,
              },
              {
                ratio: "1:1",
                use: "Avatar · testimonial card · founder portrait",
                w: 240,
                h: 240,
              },
              {
                ratio: "3:4",
                use: "Carousel slide · email hero",
                w: 240,
                h: 320,
              },
            ].map((c) => (
              <div
                key={c.ratio}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 14,
                  padding: 24,
                  boxShadow: shadows.card,
                  display: "flex",
                  gap: 24,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: c.w / 1.5,
                    height: c.h / 1.5,
                    background: "linear-gradient(135deg, #E8C9A8, #8E5F3D)",
                    borderRadius: 8,
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 8,
                      fontFamily: f.mono,
                      fontSize: 10,
                      color: "rgba(255,255,255,.85)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {c.ratio}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 22,
                      fontWeight: 500,
                      color: t.coal,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {c.ratio}
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: t.indigoGray,
                      margin: "6px 0 0",
                      lineHeight: 1.55,
                    }}
                  >
                    {c.use}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 05 — TYPE OVERLAY */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Type overlay"
            desc="When type is set on a photo. Always Instrument Serif. Never on the subject's face."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: 32,
              boxShadow: shadows.card,
            }}
          >
            <div
              style={{
                position: "relative",
                height: 380,
                background: "linear-gradient(135deg, #E8C9A8 0%, #C49872 50%, #5C3D26 100%)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {/* Simulated subject silhouette on the right */}
              <div
                style={{
                  position: "absolute",
                  right: -80,
                  bottom: 0,
                  width: 280,
                  height: 280,
                  background: "rgba(0,0,0,0.20)",
                  borderRadius: "50% 50% 0 0",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 60,
                  bottom: 220,
                  width: 100,
                  height: 100,
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: "50%",
                }}
              />
              {/* Type overlay on the LEFT, where the subject isn't */}
              <div style={{ position: "absolute", left: 48, top: 56, maxWidth: "50%" }}>
                <span
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: "rgba(255,255,255,.85)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Story · Priya
                </span>
                <h3
                  style={{
                    fontFamily: f.serif,
                    fontSize: 36,
                    fontWeight: 400,
                    color: t.cream,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    margin: "16px 0 12px",
                  }}
                >
                  From four rejections to two{" "}
                  <em style={{ fontStyle: "italic", color: t.copper }}>offers</em>{" "}
                  in six weeks.
                </h3>
                <p
                  style={{
                    color: "rgba(250, 247, 240, .82)",
                    fontSize: 14,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  Twelve mock interviews. One coaching session a week. A clear
                  view of which stories were landing.
                </p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: t.indigoGray, marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
              <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> type
              always on the negative-space side · subject never covered · the
              italic accent word still appears in copper · text-on-image
              contrast must hit AA (4.5:1) — verify after color grading, not
              before.
            </p>
          </div>
        </section>

        {/* 06 — DON'TS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Common photography mistakes"
            desc="The patterns that read as 'cheap SaaS' on day one. Catch them at brief, not at launch."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 14 }}>
              {[
                "Stock photos of 'happy diverse professionals'. Detectable, generic, wrong tone.",
                "Studio strobe lighting on faces. Reads as corporate headshot, not editorial.",
                "Heavy color grading (teal-and-orange Hollywood look). Distracting and dated.",
                "Subject staring directly at the camera with a wide smile. Reads as advertisement.",
                "Photos with on-image text in sans-serif. Always Instrument Serif for image type.",
                "Generic Indian-themed visuals (lotus, saffron, taj mahal). Cliché. Use real candidates instead.",
                "Tech-bro aesthetics (laptops on rooftops, hoodies + sunglasses). We're not that brand.",
                "Group photos as the primary marketing visual. Individuals tell stories better.",
              ].map((line, i) => (
                <li
                  key={i}
                  style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.6, paddingLeft: 18, position: "relative" }}
                >
                  <span style={{ position: "absolute", left: 0, color: t.error, fontWeight: 600 }}>×</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="Real, not stock. Warm, not corporate. Indian, not generic." />
      </div>
    </>
  );
}
