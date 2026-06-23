/**
 * FooterDome — canvas-local design mockup (1728 × 460).
 *
 * Replicates the supplied footer reference:
 *   • Warm cream field, three-column layout
 *   • Left: PRODUCT eyebrow + nav links, © 2026 pinned bottom-left
 *   • Center: serif headline with copper-italic "both" + 3-line muted blurb
 *   • Right: COMPANY eyebrow + nav links, 3 social icons bottom-right
 *   • Signature burnt-copper half-dome rising from bottom-center,
 *     clipped by the frame, carrying the white HireStepX wordmark
 */

/* ── Design tokens ── */
const CREAM   = "#FAF7F0";
const COAL    = "#1A1510";
const COPPER  = "#B4530A";
const DOME    = "#BC551C";
const MUTED   = "#878B95"; // slate-blue links / body
const MUTEDLT = "#A9AAB0"; // © 2026
const ICONBD  = "#BCBDC4";
const ICONFG  = "#8A8E98";

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS  = '"Satoshi", "Inter", system-ui, sans-serif';

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');
@keyframes fdFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fdRise   { from { opacity: 0; transform: translate(-50%, 40px); } to { opacity: 1; transform: translate(-50%, 0); } }
.fd-link {
  display: block;
  font-family: ${SANS};
  font-size: 16px;
  font-weight: 400;
  color: ${MUTED};
  text-decoration: none;
  letter-spacing: -0.01em;
  line-height: 1;
  margin-bottom: 22px;
  transition: color 0.15s ease;
  width: fit-content;
}
.fd-link:hover { color: ${COAL}; }
.fd-eyebrow {
  font-family: ${SANS};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: ${COPPER};
  text-transform: uppercase;
  margin: 0 0 26px;
}
.fd-social {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${ICONBD};
  color: ${ICONFG};
  transition: border-color 0.15s ease, color 0.15s ease;
  cursor: pointer;
}
.fd-social:hover { border-color: ${COPPER}; color: ${COPPER}; }
`;

const PRODUCT_LINKS = ["Pricing", "Blog", "Sign Up"];
const COMPANY_LINKS = ["About", "Privacy", "Terms", "Refund Policy", "About"];

function IgIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231 5.447-6.231Zm-1.16 17.52h1.833L7.084 4.126H5.117L17.084 19.77Z" />
    </svg>
  );
}
function InIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21H9V9Z" />
    </svg>
  );
}

export default function FooterDome() {
  return (
    <div
      style={{
        position: "relative",
        width: 1728,
        height: 460,
        background: CREAM,
        overflow: "hidden",
        fontFamily: SANS,
      }}
    >
      <style>{STYLE}</style>

      {/* ── Left column ── */}
      <div style={{ position: "absolute", left: 96, top: 84, animation: "fdFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}>
        <p className="fd-eyebrow">Product</p>
        {PRODUCT_LINKS.map((l) => (
          <a key={l} href="#" className="fd-link">{l}</a>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 44,
          fontFamily: SANS,
          fontSize: 14,
          color: MUTEDLT,
          letterSpacing: "0.01em",
        }}
      >
        © 2026
      </div>

      {/* ── Center block — full-width flex container, children centered ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 76,
          width: 1728,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "fdFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.12s both",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 36,
            fontWeight: 400,
            lineHeight: 1.12,
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
            color: COAL,
            textAlign: "center",
          }}
        >
          People who have sat on{" "}
          <em style={{ fontStyle: "italic", color: COPPER }}>both</em> sides of the
          table.
        </h2>
        <p
          style={{
            margin: "18px 0 0",
            width: 520,
            fontFamily: SANS,
            fontSize: 14.5,
            fontWeight: 400,
            lineHeight: 1.68,
            letterSpacing: "-0.004em",
            color: MUTED,
            textAlign: "center",
          }}
        >
          Built by someone who sat through enough Indian-tech interview cycles services,
          GCC, product, to know where the prep most students do actually breaks. The
          product reflects that frustration, not a placement-cell pitch deck.
        </p>
      </div>

      {/* ── Right column ── */}
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 84,
          textAlign: "left",
          animation: "fdFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.05s both",
        }}
      >
        <p className="fd-eyebrow">Company</p>
        {COMPANY_LINKS.map((l, i) => (
          <a key={l + i} href="#" className="fd-link">{l}</a>
        ))}
      </div>

      {/* ── Social icons ── */}
      <div style={{ position: "absolute", right: 96, bottom: 40, display: "flex", gap: 12 }}>
        <span className="fd-social"><IgIcon /></span>
        <span className="fd-social"><XIcon /></span>
        <span className="fd-social"><InIcon /></span>
      </div>

      {/* ── Video dome ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 286,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          overflow: "hidden",
          transform: "translateX(-50%)",
          animation: "fdRise 0.7s cubic-bezier(0.22,1,0.36,1) 0.2s both",
          background: DOME,
        }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            display: "block",
          }}
        >
          <source src="/HX.mp4" type="video/mp4" />
        </video>
      </div>
      {/* ── Wordmark on dome ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 368,
          transform: "translateX(-50%)",
          fontFamily: SANS,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          whiteSpace: "nowrap",
          animation: "fdRise 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s both",
        }}
      >
        HireStep<span style={{ fontWeight: 700 }}>X</span>
      </div>
    </div>
  );
}
