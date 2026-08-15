import Link from "next/link";
import type { Metadata } from "next";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
import { editorialCSS, DarkBand, ctaPrimaryStyle } from "@/marketing-v2/_editorial";

export const metadata: Metadata = {
  title: "Hire from HireStepX's practicing talent roster",
  description:
    "Post a requirement and get an AI-matched shortlist of candidates who've been practicing on HireStepX — with real interview-performance signal, not just a resume.",
};

export default function EmployersLandingPage() {
  return (
    <>
      <style>{editorialCSS}</style>
      <NavV2 />
      <div style={{ background: t.cream, minHeight: "60vh" }}>
      <section style={{ maxWidth: 880, margin: "0 auto", padding: "96px 24px 64px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            fontFamily: f.mono,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: t.copper,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          For employers
        </div>
        <h1 style={{ fontFamily: f.serif, fontSize: 44, color: t.coal, margin: "0 0 16px", lineHeight: 1.15 }}>
          Hire candidates who've already proven how they interview
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 17, color: t.inkSoft, maxWidth: 620, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Post a role. We match it against candidates actively practicing on HireStepX and hand you a shortlist
          scored on real interview performance — STAR-rubric answers, not just keywords on a resume.
        </p>
        <Link
          href="/login?next=/employer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 26px",
            borderRadius: 12,
            background: t.indigo,
            color: t.white,
            fontFamily: f.sans,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Get started
        </Link>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, marginTop: 12 }}>
          Free to post. Free to view every candidate's contact details.
        </p>
      </section>

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 96px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {[
          { title: "AI-matched, not keyword-matched", body: "Candidates are ranked on interview-performance signal — coherence, STAR structure, technical depth — scored across their real practice sessions." },
          { title: "Free candidate contact details", body: "Browse match scores, skill breakdowns, and full contact details for every candidate — no per-candidate fee." },
          { title: "Fair to candidates too", body: "Every shortlist runs through anti-gaming and fairness checks, and candidates consent to being surfaced before you ever see their name." },
        ].map((f2) => (
          <div key={f2.title} style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal, margin: "0 0 8px" }}>{f2.title}</h3>
            <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>{f2.body}</p>
          </div>
        ))}
      </section>

      <DarkBand eyebrow="Hiring, not hoping" title="Skip the resume pile," accent="hire on proof." videoSrc="/cta.mp4">
        <p style={{ fontFamily: f.sans, fontSize: 16, color: t.creamMuted, lineHeight: 1.65, maxWidth: "38ch", margin: 0 }}>
          Every candidate on the roster has already practiced and been scored on real interview performance. Post a role and see your shortlist in minutes.
        </p>
        <Link href="/login?next=/employer" className="ed-cta" style={ctaPrimaryStyle("lg")}>
          Post a role, free <span className="ed-cta-arrow" aria-hidden>→</span>
        </Link>
      </DarkBand>
      </div>
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
