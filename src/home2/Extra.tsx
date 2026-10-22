"use client";
import { useState } from "react";
import { useReveal } from "./motion";

const Lock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" /></svg>
);

const QA: [string, string][] = [
  ["How does a practice session work?", "You answer interview questions out loud. The AI listens, marks each answer on STAR (situation, task, action, result) and shows the exact sentence to fix."],
  ["Is it free to start?", "Yes. Your first 2 sessions are free and no card is needed."],
  ["Who can see my profile?", "Discovery is on by default, with your identity masked. Employers can search by role and scores and see a code, never your name, phone or email. Switch it off in Settings and you vanish from search."],
  ["Is my voice recorded?", "We do not store it. Your voice goes to speech-to-text providers (Deepgram in the US, Sarvam in India) to be turned into text, and they do not keep it. We save only the written transcript."],
  ["Can I delete everything?", "Yes. Delete your account in Settings. Your profile disappears at once and your resume, answers and scores are permanently erased within 7 days."],
];

const Bars = () => (
  <svg viewBox="0 0 64 20" className="hx-bars-svg" aria-hidden="true">
    {[6, 12, 18, 10, 16, 8, 14, 18, 9, 13, 6, 11].map((h, k) => <rect key={k} x={k * 5.3 + 1} y={10 - h / 2} width="2.6" height={h} rx="1.3" />)}
  </svg>
);

function PrivStage({ i }: { i: number }) {
  const [on, setOn] = useState(true);
  return (
    <div className="hx-priv-stage" aria-live="polite">
      <div className="hx-priv-top">
        <span className="hx-priv-lab"><i className="hx-gdot" />{QA[i][0]}</span>
        {i === 2 && (
          <button type="button" role="switch" aria-checked={on} aria-label="Let employers find me" className="hx-sw" onClick={() => setOn(!on)}>
            <i /><em>{on ? "On" : "Off"}</em>
          </button>
        )}
      </div>
      <div className="hx-priv-body" key={i === 2 ? `d${on}` : i}>
        {i === 0 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">After each answer</p>
            <div className="hx-mini-score hx-pv-score">
              <ul>{["S", "T", "A", "R"].map((l) => <li key={l} className={l === "R" ? "miss" : ""}>{l}</li>)}</ul>
              <strong>72</strong>
            </div>
            <p className="hx-pv-note">Result is missing. Say what changed, with a number.</p>
          </div>
        )}
        {i === 1 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">Start here</p>
            {["Session 1", "Session 2"].map((n) => (
              <div className="hx-pv-row" key={n}><div><b>{n}</b><span>Full interview, scored report</span></div><em className="hx-pv-tag">Free</em></div>
            ))}
            <p className="hx-pv-note">No card needed.</p>
          </div>
        )}
        {i === 2 && (on ? (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">What an employer sees</p>
            <div className="hx-vis-row">
              <span className="hx-vis-av">4F</span>
              <div><b>Candidate 4F2K</b><span>Product Analyst · Bengaluru</span></div>
              <strong>82</strong>
            </div>
            <div className="hx-vis-lock">
              {["Name", "Phone", "Email"].map((f) => <span key={f}><Lock />{f}</span>)}
            </div>
          </div>
        ) : (
          <div className="hx-priv-card hx-priv-off">You do not appear in any search.</div>
        ))}
        {i === 3 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">After you answer</p>
            <div className="hx-pv-row"><Bars /><div><b>Your voice</b><span>Deleted once it is turned into text</span></div><em className="hx-pv-tag gone">Not kept</em></div>
            <div className="hx-pv-row"><span className="hx-pv-doc" aria-hidden="true"><i /><i /><i /></span><div><b>Written transcript</b><span>Saved to your report</span></div><em className="hx-pv-tag">Kept</em></div>
          </div>
        )}
        {i === 4 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">When you delete</p>
            <ol className="hx-pv-steps">
              <li><b>Right away</b><span>Your profile is hidden from employers</span></li>
              <li><b>Within 7 days</b><span>Resume, answers and scores are permanently erased</span></li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export function Trust() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [open, setOpen] = useState(0);
  const shown = open < 0 ? 0 : open;
  return (
    <section className="hx-sec hx-privacy" id="faq">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="hx-tr">
          <div className="hx-tr-l">
            <span className="hx-kicker hx-ri" style={{ ["--i" as string]: 0 }}>Questions</span>
            <h2 className="hx-h2 hx-pt hx-ri" style={{ ["--i" as string]: 1 }}>Questions, <b>answered plainly</b>.</h2>
            <div className="hx-ri" style={{ ["--i" as string]: 2 }}><PrivStage i={shown} /></div>
          </div>
          <div className="hx-faq hx-ri" style={{ ["--i" as string]: 3 }}>
            {QA.map(([q, a], i) => (
              <div key={q} className="hx-fi" data-open={open === i}>
                <button type="button" className="hx-fq" aria-expanded={open === i} aria-controls={`hx-fa-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span className="hx-ft"><i className="hx-gdot" />{q}</span>
                  <span className="hx-fchev" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5v11M2.5 8h11" /></svg></span>
                </button>
                <div className="hx-fp" id={`hx-fa-${i}`} role="region"><div><p>{a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
