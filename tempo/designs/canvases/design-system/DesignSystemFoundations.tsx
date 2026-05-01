/* HireStepX — Design System / Foundations
   Spacing · Radius · Elevation · Lines · Iconography
   The atomic units that scaffold every component. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
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
      <div style={{ fontFamily: f.mono, fontSize: 12, color: t.indigo }}>{px}px</div>
      <div>
        <div
          style={{
            height: 16,
            width: px,
            background: t.copper,
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ color: t.indigoGray, fontSize: 12 }}>{use}</div>
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
        borderRadius: 14,
        padding: 24,
      }}
    >
      <div
        style={{
          height: 100,
          background: t.indigo100,
          border: `1.5px solid ${t.indigo}`,
          borderRadius: px,
          marginBottom: 14,
        }}
      />
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.coal, fontWeight: 500 }}>
        {token}
      </div>
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.indigo, marginTop: 4 }}>
        {px === 9999 ? "999px (pill)" : `${px}px`}
      </div>
      <div style={{ fontSize: 12, color: t.indigoGray, marginTop: 8, lineHeight: 1.5 }}>
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
        borderRadius: 14,
        padding: 32,
      }}
    >
      <div
        style={{
          height: 100,
          background: t.white,
          borderRadius: 10,
          boxShadow: shadow,
          marginBottom: 24,
        }}
      />
      <div style={{ fontFamily: f.mono, fontSize: 11, color: t.coal, fontWeight: 500 }}>
        {token}
      </div>
      <div style={{ fontSize: 12, color: t.indigoGray, marginTop: 8, lineHeight: 1.5 }}>
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
        borderRadius: 14,
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
      <div style={{ fontSize: 12, color: t.indigoGray, marginTop: 6, lineHeight: 1.5 }}>{use}</div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemFoundations() {
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
        <header
          style={{
            borderBottom: `1px solid ${t.line}`,
            paddingBottom: 40,
            marginBottom: 64,
          }}
        >
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
            Foundations, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>multiplication</em>.
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
            The atoms that scaffold every component. A 4px grid, six radii,
            three elevations, and a single icon family. Multiply, never invent.
          </p>
        </header>

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
              borderRadius: 14,
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
            desc="Six options. Each tied to a class of surface."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            <RadiusTile
              token="--radius-sm"
              px={4}
              use="Tags · hex chips · inline code"
            />
            <RadiusTile
              token="--radius-md"
              px={6}
              use="Form fields (small) · tight chips"
            />
            <RadiusTile
              token="--radius-lg"
              px={10}
              use="Buttons · inputs · panels · default"
            />
            <RadiusTile
              token="--radius-xl"
              px={14}
              use="Cards · modals · score panels"
            />
            <RadiusTile
              token="--radius-2xl"
              px={20}
              use="Hero cards · large surfaces · bottom sheets"
            />
            <RadiusTile
              token="--radius-pill"
              px={9999}
              use="Avatars · badges · rounded chips · tags"
            />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> bigger
            surface, larger radius. Buttons sit at 10px. Cards at 14px. The
            score card at 20px. Pills only for things shaped like ovals.
          </p>
        </section>

        {/* 03 — ELEVATION */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Elevation"
            desc="Three shadows. Soft, warm, never harsh. Built to sit on cream, not white."
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
              shadow="0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)"
              use="Default card lift. The 'sitting on cream' baseline."
            />
            <ShadowTile
              token="--shadow-cta"
              shadow="0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)"
              use="Primary CTAs. Slight extra grounding so buttons feel pressable."
            />
            <ShadowTile
              token="--shadow-modal"
              shadow="0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)"
              use="Modals · drawers · floating menus. Lifted off the page."
            />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> shadows are
            warm-toned (rgba of coal, not pure black). Never use a default
            grey-blue Material shadow — it clashes with the cream surface.
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
                borderRadius: 14,
                padding: 32,
              }}
            >
              <MonoLabel>--line · default</MonoLabel>
              <div style={{ height: 1, background: t.line, margin: "20px 0" }} />
              <p
                style={{
                  fontSize: 13,
                  color: t.indigoGray,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Card borders, section dividers, table rows. Quiet.
              </p>
              <Hex v="#EBE5D2" />
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 32,
              }}
            >
              <MonoLabel>--line-strong · prominent</MonoLabel>
              <div style={{ height: 1, background: t.lineStrong, margin: "20px 0" }} />
              <p
                style={{
                  fontSize: 13,
                  color: t.indigoGray,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Input borders, focused state outlines, key dividers.
              </p>
              <Hex v="#D6CDB5" />
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
              borderRadius: 14,
              padding: "32px 36px",
              boxShadow: shadows.card,
            }}
          >
            <MonoLabel color={t.copper}>The icon set</MonoLabel>
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
              borderRadius: 14,
              padding: "28px 32px",
              fontFamily: f.mono,
              fontSize: 13,
              lineHeight: 1.8,
              overflowX: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* HireStepX — Foundation tokens */\n"}
            </span>
            <span style={{ color: "#d8d2c0" }}>{":root {\n"}</span>
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>{"  /* Spacing — 4px grid */\n"}</span>
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
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>{"  /* Radius */\n"}</span>
            <span style={{ color: "#c4a8ff" }}>{"  --radius-sm"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>4px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-md"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>6px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-lg"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>10px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-xl"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>14px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-2xl"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>20px</span>;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --radius-pill"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>999px</span>;{"\n\n"}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>{"  /* Elevation */\n"}</span>
            <span style={{ color: "#c4a8ff" }}>{"  --shadow-card"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --shadow-cta"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)</span>
            ;{"\n"}
            <span style={{ color: "#c4a8ff" }}>{"  --shadow-modal"}</span>:{" "}
            <span style={{ color: "#f4d4a8" }}>0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)</span>
            ;{"\n}"}
          </pre>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="4px grid · One icon family · Three shadows · Six radii." />
      </div>
    </>
  );
}
