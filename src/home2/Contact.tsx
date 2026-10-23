"use client";
import { useState } from "react";
import { Arrow, Close, Shell } from "./Pages";
import { delay, useReveal } from "./motion";
import { FaqBlock } from "./Extra";

type Topic = {
  id: string;
  label: string;
  hint: string;
  answer: string;
  steps: string[];
  reply: string;
  placeholder: string;
  chips: string[];
  icon: React.ReactNode;
};

const ico = (d: React.ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const MAIL = "hello@hirestepx.com";

const TOPICS: Topic[] = [
  {
    id: "score",
    label: "A session or score",
    hint: "Reports, scores, voice or tech issues",
    answer: "Most score questions are fastest from inside the report.",
    steps: ["Open the session report", "Choose Dispute score", "We review it within 24 hours"],
    reply: "Within 1 business day",
    placeholder: "Which session, which role, and what looked off?",
    chips: ["Score felt too low", "Score felt too high", "My voice was not picked up", "Session would not start", "Report did not load"],
    icon: ico(<><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>),
  },
  {
    id: "billing",
    label: "Payment or refund",
    hint: "Charges, failed payments, refunds",
    answer: "Refund requests are processed within 5 working days.",
    steps: ["Write to us from your account email", "Mention the payment date and amount", "We confirm the refund in writing"],
    reply: "Within 1 business day",
    placeholder: "What did you pay for, and what went wrong?",
    chips: ["I was charged twice", "Payment failed but money left", "I want a refund", "Plan did not activate", "Need an invoice"],
    icon: ico(<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18" /><path d="M7 15h3" /></>),
  },
  {
    id: "hiring",
    label: "Hiring on HireStepX",
    hint: "Roles, matches, unlocking a candidate",
    answer: "Setting up a role, reading a ranking, or paying to unlock a candidate.",
    steps: ["Tell us the role you are hiring for", "Share what looks wrong or unclear", "We reply with next steps"],
    reply: "Within 1 business day",
    placeholder: "Which requirement are you working on?",
    chips: ["Matches look wrong", "Cannot unlock a candidate", "Payment for an unlock failed", "Need help posting a role", "Question about pricing"],
    icon: ico(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><path d="M17 8.5h4" /><path d="M19 6.5v4" /></>),
  },
  {
    id: "privacy",
    label: "Privacy or my data",
    hint: "Deletion, data requests, formal complaints",
    answer: "You can delete your account from Settings, or write to the Grievance Officer.",
    steps: ["Say what you want done with your data", "We acknowledge in 24 hours", "We resolve it within 15 days"],
    reply: "Acknowledged in 24 hours, resolved in 15 days",
    placeholder: "What would you like us to do with your data?",
    chips: ["Delete my account", "Send me my data", "Correct my data", "Make a formal complaint"],
    icon: ico(<><path d="M12 3l7 3v5c0 4.4-2.9 8-7 10-4.1-2-7-5.6-7-10V6l7-3z" /><path d="M9.2 12l2 2 3.6-4" /></>),
  },
];

const OTHER: Topic = {
  id: "other",
  label: "Something else",
  hint: "Press, partnerships, anything unlisted",
  answer: "If it does not fit the others, write it here. A person will route it.",
  steps: ["Tell us what you have in mind", "We find the right person", "You get a reply, not a ticket number"],
  reply: "Within 1 business day",
  placeholder: "Tell us what is on your mind.",
  chips: ["Press or media", "Partnership", "Feedback or an idea", "Something is broken"],
  icon: ico(<><path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v8a2.5 2.5 0 01-2.5 2.5H11l-4.5 3.5V17H6.5A2.5 2.5 0 014 14.5v-8z" /></>),
};

const ALL = [...TOPICS, OTHER];

type Status = "idle" | "sending" | "sent" | "error";

function Copy({ text, label, done, iconOnly }: { text: string; label: string; done: string; iconOnly?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={iconOnly ? "ct-copy ct-copy-ico" : "ct-copy"}
      aria-label={iconOnly ? (ok ? done : label) : undefined}
      title={iconOnly ? (ok ? done : label) : undefined}
      onClick={() => {
        try { void navigator.clipboard?.writeText(text); } catch { /* clipboard unavailable */ }
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
    >
      {iconOnly ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 017.5 4H15" /></>}
        </svg>
      ) : ok ? done : label}
    </button>
  );
}

function ContactForm({ topic }: { topic: Topic }) {
  const [status, setStatus] = useState<Status>("idle");
  const [ref, setRef] = useState<string | null>(null);
  const [pickedFor, setPickedFor] = useState<{ id: string; list: string[] }>({ id: topic.id, list: [] });
  const picked = pickedFor.id === topic.id ? pickedFor.list : [];
  const [note, setNote] = useState("");
  const ready = picked.length > 0 || note.trim().length > 0;
  const toggle = (c: string) => setPickedFor({ id: topic.id, list: picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c] });

  if (status === "sent") {
    return (
      <div className="ct-card ct-done" role="status" tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })}>
        <span className="ct-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 30}deg` }} />)}
          <svg viewBox="0 0 40 40" width="56" height="56"><circle cx="20" cy="20" r="19" /><path d="M12 20.5l5.5 5.5L28 15" /></svg>
        </span>
        <h2 className="ct-h">Message sent</h2>
        <p>We will reply to your email within 1 business day.{ref ? <> Your reference is <b>{ref}</b> <Copy text={ref} label="Copy reference" done="Copied" iconOnly />.</> : null}</p>
        <div className="ct-actions">
          <button type="button" className="ct-copy" onClick={() => { setStatus("idle"); setRef(null); setPickedFor({ id: topic.id, list: [] }); setNote(""); }}>Send another</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="ct-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (status === "sending") return;
        setStatus("sending");
        const f = new FormData(e.currentTarget);
        const message = [picked.length ? `Selected: ${picked.join(", ")}` : "", note.trim() ? `Note: ${note.trim()}` : ""].filter(Boolean).join("\n\n");
        fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.get("name") ?? "", email: f.get("email") ?? "", topic: topic.label, message }),
        })
          .then((r) => r.json())
          .then((d: { ok?: boolean; ref?: string }) => {
            if (d.ok) { setRef(d.ref ?? null); setStatus("sent"); } else setStatus("error");
          })
          .catch(() => setStatus("error"));
      }}
    >
      <div className="ct-head">
        <span className="ct-about">Writing about</span>
        <span className="ct-chip" key={topic.id}>{topic.label}</span>
      </div>
      <div className="ct-row">
        <label className="ct-f"><span>Your name</span><input name="name" type="text" required autoComplete="name" placeholder="Aarav Mehta" /></label>
        <label className="ct-f"><span>Email</span><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
      </div>
      <fieldset className="ct-chips" key={topic.id}>
        <legend>What is going on? Tap all that apply.</legend>
        <div className="ct-chiprow">
          {topic.chips.map((c, i) => (
            <button key={c} type="button" className="ct-pick" aria-pressed={picked.includes(c)} style={{ ["--i" as string]: i }} onClick={() => toggle(c)}>{c}</button>
          ))}
        </div>
      </fieldset>
      <label className="ct-f">
        <span>Anything to add? <small>Optional, one line is plenty</small></span>
        <input type="text" value={note} maxLength={300} placeholder={topic.placeholder} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      {status === "error" && <p className="ct-err" role="alert">That did not send. Please try again, or email {MAIL}.</p>}
      <button type="submit" className="hx-btn lg" disabled={status === "sending" || !ready} aria-describedby={ready ? undefined : "ct-hint"}>
        {status === "sending" ? <><span className="ct-spin" aria-hidden="true" />Sending</> : <>Send message <Arrow /></>}
      </button>
      {!ready && <p className="ct-hint" id="ct-hint">Tap one option or add a line to send.</p>}
    </form>
  );
}

const CONTACT_QA: [string, string][] = [
  ["How fast will I hear back?", "Within 1 business day, India time. Privacy requests are acknowledged within 24 hours and resolved within 15 days."],
  ["How do I dispute a score?", "Open the session report and choose Dispute score. We review it within 24 hours."],
  ["How do refunds work?", "Write to us from your account email with the payment date and amount. Refunds are processed within 5 working days."],
  ["How do I delete my account?", "Do it from Settings. Your profile is hidden from employers right away, and your data is permanently erased within 7 days."],
  ["Is there a phone number or live chat?", "No. The form on this page goes to the inbox a person reads, and you get a reference number to follow up with."],
];

const CONTACT_STAGE: { cap: string; rows: [string, string][] }[] = [
  { cap: "Reply times", rows: [["Most questions", "1 business day"], ["Privacy requests", "Acknowledged in 24 hours"], ["Full resolution", "Within 15 days"]] },
  { cap: "Score disputes", rows: [["1. Open the report", "From your dashboard"], ["2. Dispute score", "Pick the answer you question"], ["3. We review", "Within 24 hours"]] },
  { cap: "Refunds", rows: [["1. Write to us", "From your account email"], ["2. Share the payment", "Date and amount"], ["3. Refund issued", "Within 5 working days"]] },
  { cap: "When you delete", rows: [["Right away", "Profile hidden from employers"], ["Within 7 days", "Resume, answers and scores erased"]] },
  { cap: "Where messages go", rows: [["The form", "Read by a person"], ["Your reference", "Quote it when you follow up"]] },
];

function ContactStage({ i }: { i: number }) {
  const d = CONTACT_STAGE[i] ?? CONTACT_STAGE[0];
  return (
    <div className="hx-priv-stage" aria-live="polite">
      <div className="hx-priv-top"><span className="hx-priv-lab"><i className="hx-gdot" />{CONTACT_QA[i]?.[0] ?? CONTACT_QA[0][0]}</span></div>
      <div className="hx-priv-body" key={i}>
        <div className="hx-priv-card">
          <p className="hx-mini-cap">{d.cap}</p>
          <ol className="hx-pv-steps">
            {d.rows.map(([b, t]) => <li key={b}><b>{b}</b><span>{t}</span></li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  const [id, setId] = useState(TOPICS[0].id);
  const topic = ALL.find((t) => t.id === id) ?? TOPICS[0];
  const { ref, on } = useReveal<HTMLDivElement>();

  return (
    <Shell active="talent">
      <style>{contactCss}</style>
      <section className="cx-hero">
        <div ref={ref} className={`hx-wrap ct-wrap hx-rv${on ? " on" : ""}`}>
          <div className="cx-copy ct-top">
            <h1 className="cx-h1 hx-ri" style={delay(1)}>Real people, <b>real replies</b>.</h1>
            <p className="cx-lede hx-ri" style={delay(2)}>Pick what you need and we will point you to the quickest route, or write to us directly. A real person reads every message.</p>
          </div>
          <div className="ct-grid">
            <div className="ct-left hx-ri" style={delay(3)}>
              <div className="ct-opts" role="radiogroup" aria-label="What can we help with?">
                {ALL.map((t) => (
                  <label key={t.id} className="ct-opt" data-on={t.id === id ? "" : undefined}>
                    <input type="radio" name="topic" value={t.id} checked={t.id === id} onChange={() => setId(t.id)} />
                    <span className="ct-ico">{t.icon}</span>
                    <span className="ct-txt"><b>{t.label}</b><small>{t.hint}</small></span>
                    <span className="ct-check" aria-hidden="true" />
                  </label>
                ))}
              </div>
              <div className="ct-ans" key={topic.id} aria-live="polite">
                <span className="ct-who">Quickest route</span>
                <p className="ct-lead">{topic.answer}</p>
                <ol className="ct-steps">
                  {topic.steps.map((s, i) => <li key={s} style={{ ["--i" as string]: i }}>{s}</li>)}
                </ol>
                <div className="ct-meta">
                  <a data-no-underline href={`mailto:${MAIL}`}>{MAIL}</a>
                  <Copy text={MAIL} label="Copy email" done="Copied" iconOnly />
                  <small>{topic.reply}</small>
                </div>
              </div>
            </div>
            <div className="hx-stage cx-demo ct-stage hx-ri" style={delay(4)}>
              <ContactForm topic={topic} />
            </div>
          </div>
        </div>
      </section>

      <FaqBlock id="contact-faq" title={<>Quick answers, <b>before you write</b>.</>} qa={CONTACT_QA} stage={(i) => <ContactStage i={i} />} />

      <div className="cx-close"><Close kicker="Not ready to write?" title={<>Try one answer <b>first</b>.</>} body="Your first 2 sessions are free, with no card on file." primary={["Practise free", "/signup"]} secondary={["See pricing", "/pricing"]} notes={["2 free sessions", "No card needed", "No subscription"]} /></div>
    </Shell>
  );
}

const contactCss = `
.ct-wrap { display: grid; gap: 48px; max-width: 1560px; }
.ct-top { text-align: center; display: grid; justify-items: center; }
.ct-top .cx-h1 { margin-top: 0; font-size: 44px; line-height: 1.06; }
.ct-top .cx-lede { margin-top: 12px; font-size: 16px; line-height: 1.5; margin-left: auto; margin-right: auto; max-width: 64ch; }
.ct-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: stretch; width: 100%; }
.ct-left { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.ct-left .ct-ans { flex: 1; align-content: start; }
.hx-stage.cx-demo.ct-stage { display: grid; padding: 28px; }
.ct-stage .ct-card { max-width: none; margin: 0; padding: 28px; gap: 22px; box-shadow: none; border-radius: 16px; align-content: start; }
.ct-opts { display: grid; gap: 10px; }
.ct-opt { position: relative; display: grid; grid-template-columns: 40px 1fr 22px; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 14px; background: var(--white); border: 1px solid var(--line); cursor: pointer; transition: border-color .18s, background .18s, transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s; }
.ct-opt:hover { border-color: var(--line-2); transform: translateY(-1px); box-shadow: 0 6px 18px oklch(0.4 0.12 280 / 0.07); }
.ct-opt:focus-within { outline: 2px solid var(--btn); outline-offset: 2px; }
.ct-opt input { position: absolute; opacity: 0; pointer-events: none; }
.ct-opt[data-on] { border-color: var(--btn); background: oklch(0.975 0.014 280); }
.ct-ico { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: var(--wash); color: var(--btn); transition: background .18s, color .18s, transform .3s cubic-bezier(.22,1,.36,1); }
.ct-opt[data-on] .ct-ico { background: var(--btn); color: var(--white); transform: scale(1.06); }
.ct-txt { display: grid; gap: 1px; min-width: 0; }
.ct-txt b { font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.3; }
.ct-txt small { font-size: 14px; color: var(--ink-3); line-height: 1.4; }
.ct-check { width: 20px; height: 20px; border-radius: 99px; border: 1.5px solid var(--line-2); position: relative; transition: background .18s, border-color .18s; }
.ct-check::after { content: ''; position: absolute; left: 5px; top: 5.5px; width: 8px; height: 4.5px; border-left: 2px solid var(--white); border-bottom: 2px solid var(--white); transform: rotate(-45deg) scale(0); transition: transform .25s cubic-bezier(.22,1,.36,1); }
.ct-opt[data-on] .ct-check { background: var(--btn); border-color: var(--btn); }
.ct-opt[data-on] .ct-check::after { transform: rotate(-45deg) scale(1); }
.ct-ans { padding: 28px; border-radius: 16px; background: var(--white); border: 1px solid var(--line); display: grid; gap: 16px; animation: ct-in .42s cubic-bezier(.22,1,.36,1) both; }
@keyframes ct-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.ct-who { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--btn); }
.ct-lead { margin: 0; font-size: 17px; line-height: 1.45; font-weight: 500; color: var(--ink); }
.ct-steps { list-style: none; counter-reset: s; margin: 0; padding: 0; display: grid; gap: 12px; }
.ct-steps li { counter-increment: s; display: grid; grid-template-columns: 24px 1fr; gap: 12px; align-items: start; font-size: 15px; line-height: 1.5; color: var(--ink-2); animation: ct-in .4s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--i, 0) * 70ms + 90ms); }
.ct-steps li::before { content: counter(s); display: grid; place-items: center; width: 22px; height: 22px; border-radius: 99px; background: var(--white); border: 1px solid var(--line-2); font-size: 12px; font-weight: 600; color: var(--btn); }
.ct-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--line); }
.ct-meta a { font-size: 15px; font-weight: 500; color: var(--btn); word-break: break-all; }
.ct-meta a:hover { text-decoration: underline; text-underline-offset: 3px; }
.ct-meta small { font-size: 13px; color: var(--ink-3); }
.ct-card { max-width: 720px; margin: 0 auto; display: grid; gap: 16px; padding: 36px; border-radius: 20px; background: var(--white); border: 1px solid var(--line); box-shadow: 0 12px 32px oklch(0.4 0.12 280 / 0.08); }
.ct-head { display: flex; align-items: center; justify-content: flex-start; gap: 12px; flex-wrap: wrap; }
.ct-h { margin: 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 28px; line-height: 1.15; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.ct-chip { padding: 5px 12px; border-radius: 99px; background: oklch(0.955 0.025 280); color: var(--btn); font-size: 13px; font-weight: 500; animation: ct-pop .35s cubic-bezier(.22,1,.36,1) both; }
@keyframes ct-pop { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
.ct-about { font-size: 14px; color: var(--ink-2); }
.ct-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ct-f { display: grid; gap: 10px; }
.ct-f span { font-size: 14px; font-weight: 500; color: var(--ink); }
.ct-f input, .ct-f textarea { width: 100%; font: inherit; font-size: 15px; color: var(--ink); background: var(--white); border: 1px solid var(--line-2); border-radius: 10px; padding: 0 14px; min-height: 46px; outline: none; transition: border-color .15s, box-shadow .15s; }
.ct-f textarea { padding: 12px 14px; resize: vertical; line-height: 1.5; min-height: 132px; }
.ct-f input::placeholder, .ct-f textarea::placeholder { color: var(--ink-3); }
.ct-f input:focus, .ct-f textarea:focus { border-color: var(--btn); box-shadow: 0 0 0 3px oklch(0.359 0.135 278.697 / 0.14); }
.ct-chips { border: 0; padding: 0; margin: 0; display: grid; gap: 10px; min-width: 0; }
.ct-chips legend { padding: 0; margin-bottom: 14px; font-size: 14px; font-weight: 500; color: var(--ink); }
.ct-chiprow { display: flex; flex-wrap: wrap; gap: 10px; }
.ct-pick { appearance: none; font: inherit; font-size: 14px; color: var(--ink-2); background: var(--white); border: 1px solid var(--line-2); border-radius: 99px; padding: 10px 16px; min-height: 44px; cursor: pointer; transition: background .18s, border-color .18s, color .18s, transform .2s cubic-bezier(.22,1,.36,1); animation: ct-in .35s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--i, 0) * 45ms); }
.ct-pick:hover { border-color: var(--btn); }
.ct-pick:active { transform: scale(.97); }
.ct-pick:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.ct-pick[aria-pressed="true"] { background: var(--btn); border-color: var(--btn); color: var(--white); }
.ct-f small { font-size: 13px; font-weight: 400; color: var(--ink-3); margin-left: 6px; }
.ct-star { display: grid; gap: 12px; }
.ct-card .hx-btn { width: 100%; margin-top: 8px; border: 0; cursor: pointer; font-family: inherit; }
.ct-card .hx-btn:disabled { opacity: .7; cursor: default; }
.ct-spin { width: 16px; height: 16px; border-radius: 99px; border: 2px solid oklch(1 0 0 / 0.35); border-top-color: var(--white); animation: ct-rot .7s linear infinite; }
@keyframes ct-rot { to { transform: rotate(360deg); } }
.ct-err { margin: 0; font-size: 14px; color: oklch(0.5 0.17 25); }
.ct-done { text-align: left; gap: 12px; }
.ct-done p { margin: 0; font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.ct-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.ct-copy { appearance: none; font: inherit; font-size: 14px; font-weight: 500; color: var(--btn); background: transparent; border: 1px solid var(--line-2); border-radius: 10px; padding: 8px 14px; cursor: pointer; transition: border-color .15s, background .15s; }
.ct-copy-ico { display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; vertical-align: middle; margin-left: 4px; }
.ct-hint { margin: -10px 0 0; text-align: center; font-size: 13px; color: var(--ink-3); }
.ct-done:focus { outline: none; }
.ct-copy:hover { border-color: var(--btn); background: var(--wash); }
.ct-burst { position: relative; display: grid; place-items: center; width: 56px; height: 56px; color: var(--btn); }
.ct-burst svg { position: relative; z-index: 1; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.ct-burst circle { stroke-dasharray: 120; stroke-dashoffset: 120; animation: ct-draw .6s cubic-bezier(.22,1,.36,1) forwards; }
.ct-burst path { stroke-dasharray: 26; stroke-dashoffset: 26; animation: ct-draw .4s .35s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes ct-draw { to { stroke-dashoffset: 0; } }
.ct-burst i { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px; border-radius: 99px; background: var(--btn); opacity: 0; transform: rotate(var(--a)) translateY(0); animation: ct-fly .8s .4s cubic-bezier(.22,1,.36,1) forwards; }
.ct-burst i:nth-child(3n) { background: oklch(0.62 0.15 155); }
.ct-burst i:nth-child(3n+1) { background: oklch(0.72 0.14 80); width: 5px; height: 5px; }
@keyframes ct-fly { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(1); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-46px) scale(.4); } }
@media (prefers-reduced-motion: reduce) {
  .ct-ans, .ct-steps li, .ct-chip, .ct-pick, .ct-spin, .ct-burst i { animation: none; }
  .ct-burst i { display: none; }
  .ct-burst circle, .ct-burst path { animation: none; stroke-dashoffset: 0; }
  .ct-opt, .ct-ico, .ct-check::after, .ct-pick { transition: none; }
  .ct-opt:hover { transform: none; }
}
@container (max-width: 900px) {
    .ct-top .cx-h1 { font-size: 32px; }
    .ct-top .cx-lede { font-size: 15px; }
    .hx-stage.cx-demo.ct-stage { padding: 14px; gap: 14px; }
    .ct-card, .ct-stage .ct-card { padding: 22px; }
    .ct-ans { padding: 22px; }
    .ct-wrap { gap: 32px; }
    .ct-grid { grid-template-columns: 1fr; gap: 24px; }
  .ct-row { grid-template-columns: 1fr; }
    }
`;
