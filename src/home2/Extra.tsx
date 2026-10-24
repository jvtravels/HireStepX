"use client";
import Skel from "./Skel";
import { useState } from "react";
import { useReveal } from "./motion";
import { JsonLd, faqPage } from "./jsonld";

const Lock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" /></svg>
);

const QA: [string, string][] = [
  ["How does a practice session work?", "You pick a round (HR, behavioural, technical, campus placement or salary negotiation) and answer out loud. The AI scores each answer on that round\'s own scorecard, tracks your readiness against the hire bar, and shows the exact sentence to fix."],
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

export function FaqBlock({ id, title, qa, stage }: { id?: string; title: React.ReactNode; qa: [string, string][]; stage: (i: number) => React.ReactNode }) {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [open, setOpen] = useState(0);
  const shown = open < 0 ? 0 : open;
  return (
    <section className="hx-sec hx-privacy" id={id}>
      <JsonLd data={faqPage(qa)} />
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="hx-tr">
          <div className="hx-tr-l">
            <span className="hx-kicker hx-ri" style={{ ["--i" as string]: 0 }}>Questions</span>
            <h2 className="hx-h2 hx-pt hx-ri" style={{ ["--i" as string]: 1 }}>{title}</h2>
            <Skel replayKey={shown}>{stage(shown)}</Skel>
          </div>
          <div className="hx-faq hx-ri" style={{ ["--i" as string]: 3 }}>
            {qa.map(([q, a], i) => (
              <div key={q} className="hx-fi" data-open={open === i}>
                <button type="button" className="hx-fq" id={`${id ?? "hx"}-fq-${i}`} aria-expanded={open === i} aria-controls={`${id ?? "hx"}-fa-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span className="hx-ft"><i className="hx-gdot" />{q}</span>
                  <span className="hx-fchev" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5v11M2.5 8h11" /></svg></span>
                </button>
                <div className="hx-fp" id={`${id ?? "hx"}-fa-${i}`} role="region" aria-labelledby={`${id ?? "hx"}-fq-${i}`}><div><p>{a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Trust() {
  return <FaqBlock id="faq" title={<>Questions, <b>answered plainly</b>.</>} qa={QA} stage={(i) => <PrivStage i={i} />} />;
}

const EMP_QA: [string, string][] = [
  ["Can I hire for any role?", "Describe any role. We rank the people in our pool who fit it, so a niche role may show fewer matches than a common one."],
  ["How are candidates ranked?", "Mostly on how well their role, skills and location fit what you posted. Practice adds to that: how well they scored and how many sessions they have done."],
  ["Who are these candidates?", "People preparing for interviews on HireStepX. You read their scores and answers first. Their name and contact stay hidden until you unlock them, and candidates who have opted out are never shown."],
  ["Does the candidate know I looked?", "They get a general notice that an employer viewed their practice evidence. It never names your company or role."],
  ["What if nobody fits yet?", "Matching reruns every night and whenever a candidate updates their resume, so new people can appear after you post."],
  ["Do I pay to post a job?", "No. Posting, matching, reading scores and comparing are free. You pay only when you unlock a candidate to contact."],
];

function EmpStage({ i }: { i: number }) {
  const [role, setRole] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const ROLES: [string, string, string][] = [
    ["Backend Engineer", "Many matches", "Common"],
    ["Quantum chemist", "A few matches", "Niche"],
  ];
  return (
    <div className="hx-priv-stage" aria-live="polite">
      <div className="hx-priv-top">
        <span className="hx-priv-lab"><i className="hx-gdot" />{EMP_QA[i][0]}</span>
        {i === 2 && (
          <button type="button" role="switch" aria-checked={unlocked} aria-label="Unlock this candidate" className="hx-sw" onClick={() => setUnlocked(!unlocked)}>
            <i /><em>{unlocked ? "Unlocked" : "Locked"}</em>
          </button>
        )}
      </div>
      <div className="hx-priv-body" key={i === 2 ? `u${unlocked}` : i === 0 ? `r${role}` : i}>
        {i === 0 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">Pick a role</p>
            <div className="hx-pv-row">
              {ROLES.map(([r], k) => (
                <button key={r} type="button" className="hx-pv-opt" aria-pressed={role === k} onClick={() => setRole(k)}>{r}</button>
              ))}
            </div>
            <p className="hx-pv-note">{ROLES[role][1]} in the pool. <em className="hx-pv-tag">{ROLES[role][2]}</em></p>
          </div>
        )}
        {i === 1 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">What moves a candidate up</p>
            <div className="hx-pv-row"><div><b>Role, skills, location</b><span>How well they fit your post</span></div><em className="hx-pv-tag">Mostly</em></div>
            <div className="hx-pv-row"><div><b>Practice</b><span>Scores and sessions done</span></div><em className="hx-pv-tag">Adds</em></div>
          </div>
        )}
        {i === 2 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">{unlocked ? "After you unlock" : "What you see first"}</p>
            <div className="hx-vis-row">
              <span className="hx-vis-av">4F</span>
              <div><b>{unlocked ? "Name and contact shown" : "Candidate 4F2K"}</b><span>Product Analyst · Bengaluru</span></div>
              <strong>82</strong>
            </div>
            <div className="hx-vis-lock">
              {["Name", "Phone", "Email"].map((f) => <span key={f}>{unlocked ? <b className="hx-vis-open">{f}</b> : <><Lock />{f}</>}</span>)}
            </div>
          </div>
        )}
        {i === 3 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">What the candidate gets</p>
            <div className="hx-pv-row"><div><b>An employer viewed your practice evidence</b><span>A general notice</span></div></div>
            <div className="hx-pv-row"><div><b>Your company</b></div><em className="hx-pv-tag gone">Never named</em></div>
            <div className="hx-pv-row"><div><b>Your role</b></div><em className="hx-pv-tag gone">Never named</em></div>
          </div>
        )}
        {i === 4 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">New people can appear</p>
            <ol className="hx-pv-steps">
              <li><b>Every night</b><span>Matching reruns for your open roles</span></li>
              <li><b>When a resume changes</b><span>That candidate is matched again</span></li>
            </ol>
          </div>
        )}
        {i === 5 && (
          <div className="hx-priv-card">
            <p className="hx-mini-cap">What costs money</p>
            {["Posting a role", "Matching and scores", "Comparing candidates"].map((n) => (
              <div className="hx-pv-row" key={n}><div><b>{n}</b></div><em className="hx-pv-tag">Free</em></div>
            ))}
            <div className="hx-pv-row"><div><b>Unlocking a candidate</b></div><em className="hx-pv-tag gone" style={{ textDecoration: "none" }}>Paid</em></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmpFaq() {
  return <FaqBlock id="emp-faq" title={<>Before you <b>sign up</b>.</>} qa={EMP_QA} stage={(i) => <EmpStage i={i} />} />;
}

const CAND_QA: [string, string][] = [
  QA[0],
  ["What questions will I get?", "They come from your target role, your experience, the company you name and your resume. A backend engineer and a sales executive get different questions."],
  ["Is it free to start?", "Yes. Your first 2 sessions are free and no card is needed. After that it is ₹9 a session, or ₹39 for five sessions valid for 30 days."],
  QA[2],
  QA[3],
  QA[4],
];

const SAMPLE_Q: [string, string[]][] = [
  ["Backend Engineer", ["How would you design a rate limiter?", "Tell me about a time you made something faster.", "How do you debug a slow query?"]],
  ["Product Analyst", ["How would you size the market for a new feature?", "A metric dropped 8% overnight. What do you check first?", "Tell me about a time data changed your mind."]],
  ["Sales Executive", ["Sell me this pen.", "Tell me about a deal you almost lost.", "How do you handle a client who says it costs too much?"]],
];

function CandStage({ i }: { i: number }) {
  const [role, setRole] = useState(0);
  if (i !== 1) return <PrivStage i={i === 0 ? 0 : i === 2 ? 1 : i - 1} />;
  return (
    <div className="hx-priv-stage" aria-live="polite">
      <div className="hx-priv-top"><span className="hx-priv-lab"><i className="hx-gdot" />{CAND_QA[1][0]}</span></div>
      <div className="hx-priv-body" key={role}>
        <div className="hx-priv-card">
          <p className="hx-mini-cap">Pick a role</p>
          <div className="hx-pv-row" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>
            {SAMPLE_Q.map(([r], k) => (
              <button key={r} type="button" className="hx-pv-opt" aria-pressed={role === k} onClick={() => setRole(k)}>{r}</button>
            ))}
          </div>
          <ol className="hx-pv-steps">
            {SAMPLE_Q[role][1].map((q) => <li key={q}><span>{q}</span></li>)}
          </ol>
          <p className="hx-pv-note">Samples. Yours are written from your resume.</p>
        </div>
      </div>
    </div>
  );
}

export function CandFaq() {
  return <FaqBlock id="faq" title={<>Questions, <b>answered plainly</b>.</>} qa={CAND_QA} stage={(i) => <CandStage i={i} />} />;
}
