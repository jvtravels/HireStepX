/* HireStepX — Design System / Foundations
   Spacing · Radius · Elevation · Lines · Iconography
   The atomic units that scaffold every component. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, shadows, radius } from "./_tokens";
import { MonoLabel, SectionHead, Footer, PageHeader } from "./_atoms";
function Hex({ v }: { v: string }) {
  return (
    <span
      style={{
        fontFamily: f.mono,
        fontSize: 11,
        color: t.coal,
        background: t.creamSoft,
        padding: "3px 8px",
        borderRadius: 4,
      }}
    >
      {v}
    </span>
  );
}

/* Spacing visual — shows a horizontal bar at the actual size */
function SpaceRow({
  token,
  px,
  use,
}: {
  token: string;
  px: number;
  use: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 80px 1fr 1fr",
        alignItems: "center",
        gap: 24,
        padding: "16px 24px",
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div style={{ fontFamily: f.mono, fontSize: 12, color: t.coal }}>{token}</div>
      <div style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>{px}px</div>
      <div>
        <div
          style={{
            height: 16,
            width: px,
            background: t.gray[400],
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ color: t.inkMuted, fontSize: 12 }}>{use}</div>
    </div>
  );
}

/* Radius visual — shows the corner */
function RadiusTile({
  token,
  px,
  use,
}: {
  token: string;
  px: number;
  use: string;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.lg,
        padding: 24,
      }}
    >
      <div
        style={{
          height: 100,
          background: t.creamSoft,
          border: `1.5px solid ${t.lineStrong}`,
          borderRadius: px,
          marginBottom: 14,
        }}
      />
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.coal, fontWeight: 500 }}>
        {token}
      </div>
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, marginTop: 4 }}>
        {px === 9999 ? "999px (pill)" : `${px}px`}
      </div>
      <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 8, lineHeight: 1.5 }}>
        {use}
      </div>
    </div>
  );
}

/* Shadow card */
function ShadowTile({
  token,
  shadow,
  use,
}: {
  token: string;
  shadow: string;
  use: string;
}) {
  return (
    <div
      style={{
        background: t.cream,
        border: `1px solid ${t.line}`,
        borderRadius: radius.lg,
        padding: 32,
      }}
    >
      <div
        style={{
          height: 100,
          background: t.white,
          border: `1px solid ${t.line}`,
          borderRadius: radius.md,
          boxShadow: shadow,
          marginBottom: 24,
        }}
      />
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.coal, fontWeight: 500 }}>
        {token}
      </div>
      <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 8, lineHeight: 1.5 }}>
        {use}
      </div>
    </div>
  );
}

/* Icon box */
function IconBox({
  size,
  weight,
  use,
  children,
}: {
  size: number;
  weight: number;
  use: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.lg,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          color: t.coal,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={weight}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </svg>
      </div>
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.coal, fontWeight: 500 }}>
        {size}px · {weight}w
      </div>
      <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 6, lineHeight: 1.5 }}>{use}</div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemFoundations() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
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
        {/* HEADER */}
        <PageHeader
          title="Foundations"
          description="The atoms that scaffold every component: a 4px spacing grid, three border radii, three near-flat elevations, and a single icon family. Reach for a token, never invent a one-off value."
        />

        {/* 01 — SPACING */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Spacing scale"
            desc="4px grid. Multiples only. Don't invent in-between values."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              boxShadow: shadows.card,
              padding: "8px 0",
            }}
          >
            <SpaceRow token="--space-1" px={4} use="Hairline gaps · icon insets" />
            <SpaceRow token="--space-2" px={8} use="Tight clusters · button padding-y" />
            <SpaceRow token="--space-3" px={12} use="Default text-to-input gap" />
            <SpaceRow token="--space-4" px={16} use="Card inner padding · component gap" />
            <SpaceRow token="--space-5" px={20} use="Form field rhythm" />
            <SpaceRow token="--space-6" px={24} use="Card outer padding · stack between cards" />
            <SpaceRow token="--space-8" px={32} use="Section gap · sub-section padding" />
            <SpaceRow token="--space-10" px={40} use="Major section breaks" />
            <SpaceRow token="--space-12" px={48} use="Hero padding · large modal margin" />
            <SpaceRow token="--space-16" px={64} use="Page margins (desktop) · between major sections" />
            <SpaceRow token="--space-20" px={80} use="Hero vertical · top of page" />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> if you want
            a number not on this list, you're hand-tuning. Stop. Pick the
            nearest token. Visual rhythm comes from repetition, not precision.
          </p>
        </section>

        {/* 02 — RADIUS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Border radius"
            desc="Three sizes, plus a pill shape. Small-to-medium only — never sharp, never heavily rounded."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            <RadiusTile
              token="--radius-sm"
              px={6}
              use="Tags · hex chips · inline code"
            />
            <RadiusTile
              token="--radius-md"
              px={8}
              use="Form fields · inputs · tight chips"
            />
            <RadiusTile
              token="--radius-lg"
              px={10}
              use="Buttons · cards · panels · modals · default"
            />
            <RadiusTile
              token="--radius-pill"
              px={9999}
              use="Avatars · badges · rounded chips · tags"
            />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> almost
            everything sits at 8-10px. There's no separate "hero" or "large
            surface" radius — cards, modals, and buttons all share
            --radius-lg. Pills only for things shaped like ovals.
          </p>
        </section>

        {/* 03 — ELEVATION */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Elevation"
            desc="Three near-flat shadows. The border does the definition work — shadow is only ever a faint lift."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            <ShadowTile
              token="--shadow-card"
              shadow={shadows.card}
              use="Default card lift, paired with a 1px border. The baseline for every panel."
            />
            <ShadowTile
              token="--shadow-cta"
              shadow={shadows.cta}
              use="Primary CTAs. A hair more presence so buttons feel pressable."
            />
            <ShadowTile
              token="--shadow-modal"
              shadow={shadows.modal}
              use="Modals · drawers · floating menus. The only surfaces allowed real lift."
            />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> a 1px
            border carries most surfaces on its own. Shadow is a supporting
            detail, not the effect — reach for --shadow-card by default and
            save --shadow-modal for things that actually float above the
            page.
          </p>
        </section>

        {/* 04 — LINES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Lines & dividers"
            desc="Two weights. Used to define structure, not decoration."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: 32,
              }}
            >
              <MonoLabel>--line · default</MonoLabel>
              <div style={{ height: 1, background: t.line, margin: "20px 0" }} />
              <p
                style={{
                  fontSize: 13,
                  color: t.inkMuted,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Card borders, section dividers, table rows. Quiet.
              </p>
              <Hex v="#E4E4E7" />
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: 32,
              }}
            >
              <MonoLabel>--line-strong · prominent</MonoLabel>
              <div style={{ height: 1, background: t.lineStrong, margin: "20px 0" }} />
              <p
                style={{
                  fontSize: 13,
                  color: t.inkMuted,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Input borders, focused state outlines, key dividers.
              </p>
              <Hex v="#D4D4D8" />
            </div>
          </div>
        </section>

        {/* 05 — ICONOGRAPHY */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Iconography"
            desc="Single family: Lucide. Three sizes. Two stroke weights. Never mix."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <IconBox size={16} weight={2} use="Inline · 12-14px text · button icons">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </IconBox>
            <IconBox size={20} weight={2} use="UI · navigation · controls (default)">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </IconBox>
            <IconBox size={24} weight={1.5} use="Featured · cards · large affordances">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </IconBox>
          </div>

          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "32px 36px",
              boxShadow: shadows.card,
            }}
          >
            <MonoLabel>The icon set</MonoLabel>
            <div
              style={{
                marginTop: 24,
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 20,
                color: t.coal,
              }}
            >
              {[
                {
                  name: "User",
                  path: (
                    <>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </>
                  ),
                },
                {
                  name: "Mail",
                  path: (
                    <>
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </>
                  ),
                },
                {
                  name: "Lock",
                  path: (
                    <>
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </>
                  ),
                },
                {
                  name: "Search",
                  path: (
                    <>
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </>
                  ),
                },
                {
                  name: "Check",
                  path: <path d="M20 6L9 17l-5-5" />,
                },
                {
                  name: "X",
                  path: (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  ),
                },
                {
                  name: "Mic",
                  path: (
                    <>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </>
                  ),
                },
                {
                  name: "Arrow",
                  path: (
                    <>
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </>
                  ),
                },
              ].map((icon) => (
                <div
                  key={icon.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      background: t.creamSoft,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icon.path}
                    </svg>
                  </div>
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 10,
                      color: t.inkSoft,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {icon.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> One family
            (Lucide). Stroke weight 2px at 16-20px sizes, 1.5px at 24px+.
            Always inherit color from parent — never hard-code icon colors. Use
            <code
              style={{
                fontFamily: f.mono,
                background: t.creamSoft,
                padding: "1px 6px",
                borderRadius: 3,
                margin: "0 4px",
                fontSize: 12,
              }}
            >
              currentColor
            </code>
            on stroke. No mixing line + filled styles.
          </p>
        </section>

        {/* 06 — CSS TOKENS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="CSS variables"
            desc="Drop into your stylesheet. Single source of truth."
          />
          <pre
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: radius.lg,
              padding: "28px 32px",
              fontFamily: f.mono,
              fontSize: 13,
              lineHeight: 1.8,
              overflowX: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ color: "#6b6660" }}>
              {"/* HireStepX — Foundation tokens */\n"}
            </span>
            <span style={{ color: "#d8d2c0" }}>{":root {\n"}</span>
            <span style={{ color: "#6b6660" }}>{"  /* Spacing — 4px grid */\n"}</span>
            <span style={{ color: "#c4a8ff" }}>{"  --space-1"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>4px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-2"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>8px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-3"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>12px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-4"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>16px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-6"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>24px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-8"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>32px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-12"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>48px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --space-16"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>64px</span>;{"\n\n"}
            <span style={{ color: "#6b6660" }}>{"  /* Radius */\n"}</span>
            <span style={{ color: "#c4a8ff" }}>{"  --radius-sm"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>6px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-md"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>8px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-lg"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>10px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-pill"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>999px</span>;{"\n\n"}
            <span style={{ color: "#6b6660" }}>{"  /* Elevation — near-flat */\n"}</span>
            <span style={{ color: "#c4a8ff" }}>{"  --shadow-card"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>0 1px 2px rgba(24,24,27,.04)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --shadow-cta"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>0 1px 2px rgba(24,24,27,.06), 0 2px 6px -2px rgba(24,24,27,.10)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --shadow-modal"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>0 4px 12px -2px rgba(24,24,27,.10), 0 16px 32px -12px rgba(24,24,27,.16)</span>
            ;{"\n}"}
          </pre>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="4px grid · One icon family · Three near-flat shadows · Three radii." />
      </div>
    </>
  );
}
