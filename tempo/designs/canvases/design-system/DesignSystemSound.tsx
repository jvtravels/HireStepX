/* HireStepX — Design System / Sound Identity
   Voice character · audio cues · when to use sound, when to skip.
   The product is voice-led. The sound has to be on-brand. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* Animated waveform — visualizes a sound character */
function Waveform({
  bars = 24,
  amplitude = 1,
  color = "currentColor",
  speed = 1,
}: {
  bars?: number;
  amplitude?: number;
  color?: string;
  speed?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        height: 56,
        justifyContent: "center",
        color,
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        // Make a bell-shaped distribution centered in the middle
        const center = bars / 2;
        const dist = Math.abs(i - center) / center;
        const baseHeight = (1 - Math.pow(dist, 2)) * amplitude;
        const animKey = `wave-${bars}-${i}-${speed}`;
        return (
          <div key={i}>
            <style>{`
              @keyframes ${animKey} {
                0%, 100% { height: ${Math.max(4, baseHeight * 18)}px; }
                50% { height: ${Math.max(4, baseHeight * 48)}px; }
              }
            `}</style>
            <div
              style={{
                width: 3,
                background: "currentColor",
                borderRadius: 2,
                animation: `${animKey} ${1200 / speed}ms ease-in-out infinite`,
                animationDelay: `${i * 60 / speed}ms`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main ─── */
export default function DesignSystemSound() {
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
            Sound, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>presence</em>.
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
            HireStepX is a voice-led product. The AI interviewer's voice IS
            the brand most of the time the user is engaged. Get it right, the
            rest is context.
          </p>
        </header>

        {/* 01 — VOICE CHARACTER */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="The interviewer voice"
            desc="The voice that conducts every mock interview. Every parameter chosen with intent."
          />
          <div
            style={{
              background: t.coal,
              color: t.cream,
              borderRadius: 14,
              padding: "48px 56px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            <div>
              <MonoLabel color={t.copper}>Default voice · Neerja</MonoLabel>
              <h3
                style={{
                  fontFamily: f.serif,
                  fontSize: 40,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  margin: "16px 0 24px",
                  color: t.cream,
                }}
              >
                Calm. Warm.{" "}
                <em style={{ fontStyle: "italic", color: t.copper }}>
                  Indian English.
                </em>
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(250, 247, 240, .80)",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                Azure's en-IN-NeerjaNeural. A calibrated Indian-English neural
                voice. Female, mid-30s register. Educated, professional, warm
                — like a senior sister who hires for a living, not a robot.
              </p>
            </div>
            <div
              style={{
                background: "rgba(180, 83, 9, 0.08)",
                border: "1px solid rgba(180, 83, 9, 0.20)",
                borderRadius: 14,
                padding: "32px 28px",
                color: t.copper,
              }}
            >
              <Waveform bars={28} amplitude={0.85} speed={1} />
              <div
                style={{
                  textAlign: "center",
                  marginTop: 20,
                  fontFamily: f.mono,
                  fontSize: 11,
                  color: "rgba(250, 247, 240, .55)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                "Tell me about a project you're proud of."
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <MonoLabel color={t.copper}>Voice parameters</MonoLabel>
            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                rowGap: 16,
                columnGap: 24,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {[
                { k: "Provider", v: "Azure Cognitive Services TTS · neural voices" },
                { k: "Voice ID", v: "en-IN-NeerjaNeural (default · female) · en-IN-PrabhatNeural (panel · male)" },
                { k: "Pace", v: "1.0× speed · slows to 0.95× on complex multi-part questions" },
                { k: "Pitch", v: "Default neural pitch — no SSML override (over-tuning kills naturalness)" },
                { k: "Pause behavior", v: "Inserts 250-400ms silence between sentences. Allows the candidate to think." },
                { k: "Emphasis", v: "Light SSML emphasis on the question stem. Never over-acted." },
                { k: "Fallback", v: "Cartesia (sonic-3) → Browser Web Speech API → silent transcript-only mode" },
              ].map((row) => (
                <React.Fragment key={row.k}>
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: t.coal,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ color: t.indigoGray }}>{row.v}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* 02 — PANEL VOICES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Panel interview voices"
            desc="When a panel mode is active, three distinct voices alternate. Each has a defined character."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              {
                role: "Hiring Manager",
                voice: "Neerja · female",
                tone: "Warm, strategic, asks about leadership and impact.",
                color: t.copper,
              },
              {
                role: "Technical Lead",
                voice: "Prabhat · male",
                tone: "Direct, probing, asks about architecture and trade-offs.",
                color: t.indigo,
              },
              {
                role: "HR Partner",
                voice: "Aarohi · female",
                tone: "Calm, exploratory, asks about culture and motivation.",
                color: t.success,
              },
            ].map((p) => (
              <div
                key={p.role}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 14,
                  padding: "28px 28px 32px",
                  boxShadow: shadows.card,
                }}
              >
                <MonoLabel color={p.color}>{p.role}</MonoLabel>
                <h4
                  style={{
                    fontFamily: f.serif,
                    fontSize: 22,
                    fontWeight: 500,
                    margin: "10px 0 16px",
                    color: t.coal,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {p.voice}
                </h4>
                <div style={{ color: p.color, marginBottom: 16 }}>
                  <Waveform bars={18} amplitude={0.7} speed={0.8 + Math.random() * 0.4} />
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: t.indigoGray,
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {p.tone}
                </p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> in panel
            mode, the voice changes BEFORE each question is spoken — never
            mid-sentence. The visual badge ("[Hiring Manager]") changes in
            sync with the audio cue. Users should always know who's asking.
          </p>
        </section>

        {/* 03 — UI SOUNDS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="UI sounds"
            desc="Mostly: don't. Premium products earn quiet. Two exceptions, listed here."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderLeft: `3px solid ${t.success}`,
                borderRadius: 14,
                padding: 32,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.success}>Use · interview-only</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 14 }}>
                {[
                  {
                    name: "Question chime",
                    detail:
                      "Soft 220Hz sine, 250ms, -24 LUFS. Plays once before each question begins. Signals 'next' without breaking the conversational illusion.",
                  },
                  {
                    name: "Time-up cue",
                    detail:
                      "Even softer 180Hz, 400ms decay. Plays at 30s remaining. Subtle enough that confident users barely register it; helpful enough that nervous users get the warning.",
                  },
                ].map((s) => (
                  <li key={s.name}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.coal }}>{s.name}</div>
                    <div style={{ fontSize: 13, color: t.indigoGray, marginTop: 4, lineHeight: 1.55 }}>
                      {s.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderLeft: `3px solid ${t.error}`,
                borderRadius: 14,
                padding: 32,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.error}>Avoid · everywhere else</MonoLabel>
              <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 14 }}>
                {[
                  "Click sounds on buttons — distracting, never premium",
                  "Success chimes after form submission — visual ✓ is enough",
                  "Error buzzers — read errors visually, don't startle the user",
                  "Notification sounds for non-urgent toasts — silent toasts",
                  "Onboarding 'completion' fanfare — gimmicky, undermines trust",
                  "Background ambient music — never. Ever.",
                ].map((s, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 13,
                      color: t.indigoGray,
                      lineHeight: 1.55,
                      paddingLeft: 16,
                      position: "relative",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, color: t.error, fontWeight: 600 }}>
                      ×
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 04 — VOLUME & MIXING */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Volume & mixing"
            desc="Loudness targets. Mute defaults. The discipline that prevents jump-scares."
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
                  k: "Voice level",
                  v: "-16 LUFS (broadcast standard for speech). Comfortable on phone speakers, headphones, and laptop output.",
                },
                {
                  k: "UI sound level",
                  v: "-24 LUFS (8dB below voice). Sound effects must never compete with the AI voice for attention.",
                },
                {
                  k: "Default state",
                  v: "Voice ON for interview screens. UI sounds OFF by default — opt-in via settings.",
                },
                {
                  k: "Mute respect",
                  v: "If the user mutes the device or system, we never override. Visual transcript continues. Always.",
                },
                {
                  k: "Background tab",
                  v: "When the tab is backgrounded, we pause TTS playback and wait for re-focus. Never play audio in a tab the user can't see.",
                },
                {
                  k: "Headphones detection",
                  v: "When headphones connect mid-session, do NOT auto-pause. The user expects continuity.",
                },
                {
                  k: "Loudness compression",
                  v: "Light compression (3:1 ratio) on TTS output to keep quiet syllables audible without spiking on consonants.",
                },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}
                >
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: t.copper,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
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

        {/* 05 — VOICE SAMPLE TRANSCRIPTS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="What the voice should sound like"
            desc="Sample lines, written for ear. Read aloud — they should land calm and human."
          />
          <div style={{ display: "grid", gap: 12 }}>
            {[
              {
                ctx: "Greeting · session start",
                line: "Welcome back, Arjun. Ready to begin? I'll be asking about your behavioral skills today — about 15 minutes, five questions.",
              },
              {
                ctx: "Question · open",
                line: "Tell me about a project you're proud of. Take a moment, then walk me through what you did and why it mattered.",
              },
              {
                ctx: "Follow-up · probing",
                line: "Okay. And what specifically was your role in that? Not the team's — yours.",
              },
              {
                ctx: "Reaction · acknowledgment",
                line: "Got it. That's helpful context.",
              },
              {
                ctx: "Transition · between questions",
                line: "Let's move on. Different topic.",
              },
              {
                ctx: "Time pressure · mid-session",
                line: "We've got about three minutes left. Two more questions to go — quicker pace from here.",
              },
              {
                ctx: "Closing · session end",
                line: "Alright, that wraps it up. Thank you. Generating your detailed report now — stay on this screen for a moment.",
              },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "20px 28px",
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: 24,
                  alignItems: "center",
                }}
              >
                <MonoLabel color={t.copper}>{row.ctx}</MonoLabel>
                <p
                  style={{
                    fontFamily: f.serif,
                    fontSize: 16,
                    fontStyle: "italic",
                    color: t.coal,
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  "{row.line}"
                </p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> all
            interviewer copy is written to be SPOKEN, not read. Contractions
            ("we've", "let's"). Sentence fragments. Conversational rhythm.
            Read every line aloud before shipping.
          </p>
        </section>

        {/* 06 — ACCESSIBILITY */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Accessibility"
            desc="Sound is never the only carrier of meaning. Always paired with text."
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
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
              {[
                "Live captions render every word the AI speaks, in real time. Sync to TTS audio duration.",
                "Captions are always on — there's no 'turn captions off' toggle. The brand is text-AND-voice.",
                "Hearing-impaired users can complete the entire interview via captions alone.",
                "Voice-impaired users can complete the entire interview via the type-instead toggle.",
                "All UI sounds have a visual equivalent (icon, color, position). Never sound-only signals.",
                "Audio descriptions for video content (when added) follow WCAG 2.1 AA.",
                "TTS speed adjustable from 0.75× to 1.25× in settings. Default 1.0×.",
              ].map((s, i) => (
                <li
                  key={i}
                  style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.6, paddingLeft: 18, position: "relative" }}
                >
                  <span style={{ position: "absolute", left: 0, color: t.success, fontWeight: 600 }}>✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="The voice is the brand. Quiet everywhere else." />
      </div>
    </>
  );
}
