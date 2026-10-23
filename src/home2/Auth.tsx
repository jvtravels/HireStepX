"use client";
import { useEffect, useState } from "react";
import { HomeShell } from "./Homepage";
import Skel from "./Skel";

export const authCss = `
.hx:has(> .hx-au) { height: 100%; }
.hx-au { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); height: 100%; background: var(--white); }
.hx-au-l { display: flex; flex-direction: column; padding: 32px 56px; }
.hx-au-top { display: flex; justify-content: space-between; align-items: center; }
.hx-au-top > span { font-size: 14px; color: var(--ink-2); }
.hx-au-top a:not(.hx-logo) { color: var(--btn); font-weight: 500; margin-left: 6px; }
.hx-au-main { margin: auto 0; width: 100%; max-width: 400px; align-self: center; padding: 40px 0; }
.hx-au-main h1 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 40px; font-weight: 500; letter-spacing: -0.025em; line-height: 1.1; }
.hx-au-main > p { margin-top: 12px; color: var(--ink-2); font-size: 16px; }
.hx-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: var(--wash); margin-top: 28px; }
.hx-seg button { all: unset; box-sizing: border-box; text-align: center; cursor: pointer; padding: 9px 0; border-radius: 9px; font-size: 14.5px; font-weight: 500; color: var(--ink-2); transition: background .25s, color .25s; }
.hx-seg button[aria-pressed="true"] { background: var(--white); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }
.hx-seg button:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-gbtn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 46px; margin-top: 24px; border-radius: 10px; border: 1px solid var(--line); background: var(--white); font: inherit; font-size: 15px; font-weight: 500; color: var(--ink); cursor: pointer; transition: border-color .2s, background .2s; }
.hx-gbtn:hover { border-color: var(--ink-3); background: var(--wash); }
.hx-gbtn svg { width: 18px; height: 18px; }
.hx-or { display: flex; align-items: center; gap: 14px; margin: 22px 0 4px; color: var(--ink-3); font-size: 13px; }
.hx-or::before, .hx-or::after { content: ""; flex: 1; height: 1px; background: var(--line-2); }
.hx-form { display: grid; gap: 16px; margin-top: 14px; }
.hx-lab { display: grid; gap: 6px; font-size: 14px; font-weight: 500; color: var(--ink); }
.hx-lab-row { display: flex; justify-content: space-between; align-items: baseline; }
.hx-lab-row a { font-size: 13.5px; font-weight: 400; color: var(--btn); }
.hx-in { width: 100%; box-sizing: border-box; min-height: 46px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--white); font: inherit; font-size: 15px; color: var(--ink); transition: border-color .2s, box-shadow .2s; }
.hx-in::placeholder { color: var(--ink-3); }
.hx-in:hover { border-color: var(--ink-3); }
.hx-in:focus { outline: none; border-color: var(--btn); box-shadow: 0 0 0 3px oklch(0.359 0.135 278.697 / 0.14); }
.hx-pw { position: relative; }
.hx-pw .hx-in { padding-right: 64px; }
.hx-pw button { all: unset; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--ink-2); }
.hx-pw button:hover { color: var(--ink); }
.hx-pw button:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; border-radius: 4px; }
.hx-hint { font-size: 13px; font-weight: 400; color: var(--ink-3); }
.hx-form .hx-btn { width: 100%; min-height: 48px; border: 0; font: inherit; font-size: 15px; font-weight: 500; cursor: pointer; margin-top: 4px; }
.hx-form .hx-btn:hover { background: var(--btn-hover); }
.hx-au-main > p.hx-legal { margin-top: 18px; font-size: 13px; color: var(--ink-3); }
.hx-legal a { color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; }
.hx-au-r { position: relative; padding: 16px 16px 16px 0; }
.hx-au-panel { height: 100%; border-radius: 28px; padding: 56px; display: flex; flex-direction: column; justify-content: flex-end; background: linear-gradient(155deg, oklch(0.95 0.045 55), oklch(0.955 0.035 290) 70%); }
.hx-au-panel h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 44px; font-weight: 500; letter-spacing: -0.025em; line-height: 1.08; max-width: 14ch; }
.hx-au-panel > p { margin-top: 16px; color: var(--ink-2); font-size: 17px; max-width: 36ch; }
.hx-au-stage { position: relative; flex: 1; min-height: 340px; display: grid; place-items: center; }
.hx-au-scene { position: relative; width: 460px; height: 380px; zoom: 1.2; }
.hx-au-tile { position: absolute; width: 190px; height: 232px; border-radius: 26px; overflow: hidden; background: var(--white); }
.hx-au-tile svg { display: block; width: 100%; height: 100%; }
.hx-au-tile.a { left: 14px; top: 8px; transform: rotate(-3deg); }
.hx-au-tile.b { right: 14px; top: 96px; transform: rotate(2.5deg); }
.hx-au-tag { position: absolute; left: 10px; bottom: 10px; padding: 3px 10px; border-radius: 99px; background: var(--white); font-size: 12px; font-weight: 500; color: var(--ink-2); }
.hx-au-bub { position: absolute; padding: 12px 16px; border-radius: 18px; background: var(--white); font-size: 14.5px; line-height: 1.35; color: var(--ink); max-width: 230px; border: 1px solid var(--line-2); }
.hx-au-bub small { display: block; margin-bottom: 4px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.hx-au-bub.q { left: 120px; top: 0; border-bottom-left-radius: 6px; transform: translateY(-4px); }
.hx-au-bub.r { left: 30px; top: 290px; border-bottom-right-radius: 6px; display: flex; align-items: center; gap: 12px; }
.hx-au-bub.r strong { font-family: 'Geist Mono', ui-monospace, monospace; font-weight: 500; font-size: 20px; color: var(--btn); }
.hx-au-wave { display: flex; align-items: center; gap: 3px; height: 26px; }
.hx-au-wave i { width: 3px; border-radius: 2px; background: var(--btn); opacity: .85; }
@container (max-width: 900px) {
  .hx-au { grid-template-columns: 1fr; }
  .hx-au-r { display: none; }
  .hx-au-l { padding: 20px; }
  .hx-au-main { padding: 28px 0 24px; }
  .hx-au-main h1 { font-size: 32px; }
}
`;

const Google = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 01-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
    <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.100-4.600H2.300v2.800A11 11 0 0012 23z" />
    <path fill="#FBBC05" d="M5.900 14c-.2-.7-.4-1.300-.4-2s.1-1.400.4-2V7.200H2.300a11 11 0 000 9.600z" />
    <path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.700l3.100-3.100A11 11 0 002.300 7.200L5.900 10c.8-2.600 3.200-4.600 6.100-4.600z" />
  </svg>
);


const Person = ({ skin, hair, shirt, bg, long }: { skin: string; hair: string; shirt: string; bg: string; long?: boolean }) => (
  <svg viewBox="0 0 190 232" aria-hidden="true">
    <rect width="190" height="232" fill={bg} />
    {long && <path d="M52 100c0-34 20-52 43-52s43 18 43 52v70H52z" fill={hair} />}
    <rect x="80" y="126" width="30" height="50" rx="10" fill={skin} />
    <path d="M14 232c0-46 32-62 81-62s81 16 81 62z" fill={shirt} />
    <path d="M80 170c4 14 26 14 30 0z" fill={skin} />
    <ellipse cx="95" cy="102" rx="31" ry="35" fill={skin} />
    {long ? <path d="M64 96c2-26 16-38 33-38 14 0 26 8 29 28-14-4-30-14-38-24-4 14-12 28-24 34z" fill={hair} /> : <path d="M63 98c-4-30 14-46 34-46 22 0 36 16 30 44-6-14-18-22-34-24-14 0-24 8-30 26z" fill={hair} />}
    <circle cx="84" cy="106" r="2.4" fill={hair} /><circle cx="106" cy="106" r="2.4" fill={hair} />
    <path d="M87 120c5 4 11 4 16 0" stroke={hair} strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </svg>
);

function Photo({ src, alt, fallback }: { src: string; alt: string; fallback: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  if (bad) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setBad(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

const BARS = [8, 16, 24, 12, 20, 26, 14, 8, 18, 22, 10];

export function Scene({ talent }: { talent: boolean }) {
  return (
    <Skel className="hx-au-stage">
      <div className="hx-au-scene">
        <div className="hx-au-tile a">
          <Photo src="/people/candidate.jpg" alt="A candidate smiling" fallback={<Person skin="#b9774f" hair="#2a1d1a" shirt="oklch(0.42 0.13 278)" bg="oklch(0.93 0.04 55)" />} />
          <span className="hx-au-tag">{talent ? "You" : "Candidate"}</span>
        </div>
        <div className="hx-au-tile b">
          <Photo src="/people/interviewer.jpg" alt="An interviewer smiling" fallback={<Person skin="#c98a62" hair="#1f1614" shirt="oklch(0.55 0.1 40)" bg="oklch(0.93 0.04 290)" long />} />
          <span className="hx-au-tag">{talent ? "Interviewer" : "You"}</span>
        </div>
        <div className="hx-au-bub q"><small>Question</small>Tell me about a time you made something faster.</div>
        <div className="hx-au-bub r">
          <div className="hx-au-wave" aria-hidden="true">{BARS.map((h, i) => <i key={i} style={{ height: h }} />)}</div>
          <strong>{talent ? "72" : "82"}</strong>
        </div>
      </div>
    </Skel>
  );
}

function Password({ label, hint, link }: { label: string; hint?: string; link?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <label className="hx-lab">
      <span className="hx-lab-row"><span>{label}</span>{link}</span>
      <span className="hx-pw">
        <input className="hx-in" type={show ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" />
        <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
      </span>
      {hint && <span className="hx-hint">{hint}</span>}
    </label>
  );
}

function Shell({ top, children, headline, sub, talent }: { top: React.ReactNode; children: React.ReactNode; headline: React.ReactNode; sub: string; talent: boolean }) {
  return (
    <HomeShell>
      <style>{authCss}</style>
      <div className="hx-au">
        <div className="hx-au-l">
          <div className="hx-au-top">
            <a data-no-underline className="hx-logo" href="/"><img src="/wordmark.png" alt="HireStepX" /></a>
            <span>{top}</span>
          </div>
          <div className="hx-au-main">{children}</div>
        </div>
        <div className="hx-au-r">
          <div className="hx-au-panel">
            <Scene talent={talent} />
            <h2>{headline}</h2>
            <p>{sub}</p>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

export function LoginScreen() {
  return (
    <Shell
      top={<>New here?<a href="/signup">Sign up free</a></>}
      headline={<>Pick up where you left off.</>}
      sub="Your reports and scores are waiting. Candidates and companies log in here."
      talent
    >
      <h1>Welcome back</h1>
      <p>Log in to continue.</p>
      <button type="button" className="hx-gbtn"><Google />Continue with Google</button>
      <div className="hx-or">or use your email</div>
      <form className="hx-form" onSubmit={(e) => e.preventDefault()}>
        <label className="hx-lab">Email<input className="hx-in" type="email" placeholder="you@example.com" autoComplete="email" /></label>
        <Password label="Password" link={<a href="/forgot-password">Forgot password?</a>} />
        <button type="submit" className="hx-btn">Log in</button>
      </form>
    </Shell>
  );
}

export function SignupScreen() {
  const [who, setWho] = useState<"talent" | "company">("talent");
  const talent = who === "talent";
  return (
    <Shell
      top={<>Have an account?<a href="/login">Log in</a></>}
      headline={talent ? <>Your first answer is free.</> : <>Hire from proof, not promises.</>}
      sub={talent ? "Practise out loud and see exactly what to fix. Employers only see you if you opt in." : "Read the answers behind every score. Pay only to unlock a name."}
      talent={talent}
    >
      <h1>{talent ? "Create your account" : "Create a company account"}</h1>
      <p>{talent ? "Start practising in a minute." : "Find candidates who have practised."}</p>
      <div className="hx-seg" role="group" aria-label="Account type">
        <button type="button" aria-pressed={talent} onClick={() => setWho("talent")}>I&apos;m a candidate</button>
        <button type="button" aria-pressed={!talent} onClick={() => setWho("company")}>I&apos;m hiring</button>
      </div>
      <button type="button" className="hx-gbtn"><Google />Continue with Google</button>
      <div className="hx-or">or use your email</div>
      <form className="hx-form" onSubmit={(e) => e.preventDefault()}>
        <label className="hx-lab">{talent ? "Full name" : "Your name"}<input className="hx-in" type="text" placeholder="Priya Sharma" autoComplete="name" /></label>
        {!talent && <label className="hx-lab">Company<input className="hx-in" type="text" placeholder="Company name" autoComplete="organization" /></label>}
        <label className="hx-lab">{talent ? "Email" : "Work email"}<input className="hx-in" type="email" placeholder={talent ? "you@example.com" : "you@company.com"} autoComplete="email" /></label>
        <Password label="Password" hint="At least 8 characters." />
        <button type="submit" className="hx-btn">{talent ? "Create account" : "Create company account"}</button>
      </form>
      <p className="hx-legal">By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
    </Shell>
  );
}

/* ── Password recovery ── */
const recoverCss = `
.hx-rc-ico { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 16px; margin-bottom: 22px; background: linear-gradient(155deg, oklch(0.95 0.045 55), oklch(0.955 0.035 290)); color: var(--btn); }
.hx-rc-ico svg { width: 24px; height: 24px; }
.hx-rc-ico.bad { background: oklch(0.95 0.03 25); color: oklch(0.5 0.17 25); }
.hx-rc-ico.ok { background: oklch(0.95 0.045 155); color: oklch(0.45 0.12 155); }
.hx-au-main > p b { color: var(--ink); font-weight: 500; overflow-wrap: anywhere; }
.hx-rc-cta { display: flex; flex-direction: column; gap: 10px; margin-top: 26px; }
.hx-rc-cta .hx-btn { width: 100%; min-height: 48px; justify-content: center; border: 0; font: inherit; font-size: 15px; font-weight: 500; cursor: pointer; }
.hx-rc-link { all: unset; box-sizing: border-box; cursor: pointer; text-align: center; padding: 10px 0; font-size: 14.5px; font-weight: 500; color: var(--btn); }
.hx-rc-link:disabled { cursor: default; color: var(--ink-3); font-weight: 400; }
.hx-rc-link:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; border-radius: 6px; }
.hx-rc-note { margin-top: 22px; padding: 14px 16px; border-radius: 12px; background: var(--wash); font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
.hx-rc-meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px; }
.hx-rc-meter i { height: 4px; border-radius: 4px; background: var(--line); transition: background .25s; }
.hx-rc-meter i.on { background: var(--btn); }
.hx-rc-rules { display: grid; gap: 6px; margin: 2px 0 0; padding: 0; list-style: none; font-size: 13px; color: var(--ink-3); }
.hx-rc-rules li { display: flex; align-items: center; gap: 8px; }
.hx-rc-rules li::before { content: ""; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--line); flex: none; }
.hx-rc-rules li.ok { color: var(--ink-2); }
.hx-rc-rules li.ok::before { border-color: var(--btn); background: var(--btn) center / 8px no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath d='M1.5 4.2l1.6 1.6L6.5 2.3' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
.hx-rc-err { margin-top: 6px; font-size: 13px; color: oklch(0.5 0.17 25); }
.hx-rc-timer { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: .02em; color: var(--ink-3); }
`;

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const MAIL = "M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5zM3.5 7l8.5 6 8.5-6";
const LOCK = "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3";
const LINK_OFF = "M10 14a4 4 0 005.7 0l2.6-2.6a4 4 0 00-5.7-5.7l-.6.6M14 10a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 005.7 5.7l.6-.6M4 4l16 16";
const CHECK = "M5 12.5l4.5 4.5L19 7.5";

const RECOVER_TOP = <>Remembered it?<a href="/login">Log in</a></>;
const RECOVER_PANEL = { headline: <>Back in a minute.</>, sub: "We email you a link to set a new password. Your reports and scores stay exactly as they were." };

export function ForgotPasswordScreen({ initialSent = false, email: seed = "" }: { initialSent?: boolean; email?: string }) {
  const [sent, setSent] = useState(initialSent);
  const [email, setEmail] = useState(seed);
  const [left, setLeft] = useState(initialSent ? 42 : 0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <Shell top={RECOVER_TOP} {...RECOVER_PANEL} talent>
      <style>{recoverCss}</style>
      {sent ? (
        <>
          <div className="hx-rc-ico"><Icon d={MAIL} /></div>
          <h1>Check your email</h1>
          <p>If an account exists for <b>{email || "you@example.com"}</b>, a reset link is on its way. It expires in 30 minutes.</p>
          <div className="hx-rc-cta">
            <a data-no-underline className="hx-btn" href="https://mail.google.com" target="_blank" rel="noreferrer">Open Gmail</a>
            <button type="button" className="hx-rc-link" disabled={left > 0} onClick={() => setLeft(60)}>{left > 0 ? `Resend email in ${left}s` : "Resend email"}</button>
          </div>
          <div className="hx-rc-note">Nothing in your inbox? Check spam, and make sure you used the email you signed up with. <button type="button" className="hx-rc-link" style={{ display: "inline", padding: 0, fontSize: "inherit" }} onClick={() => setSent(false)}>Use a different email</button></div>
        </>
      ) : (
        <>
          <div className="hx-rc-ico"><Icon d={LOCK} /></div>
          <h1>Reset your password</h1>
          <p>Enter the email on your account and we will send you a link.</p>
          <form className="hx-form" onSubmit={(e) => { e.preventDefault(); if (valid) { setSent(true); setLeft(60); } }}>
            <label className="hx-lab">Email<input className="hx-in" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button type="submit" className="hx-btn" disabled={!valid} style={valid ? undefined : { opacity: 0.45, cursor: "not-allowed" }}>Send reset link</button>
          </form>
        </>
      )}
    </Shell>
  );
}

type ResetState = "form" | "expired" | "used" | "done";

function ruleSet(pw: string) {
  return { len: pw.length >= 8, mix: /[a-zA-Z]/.test(pw) && /\d/.test(pw), long: pw.length >= 12 };
}

export function ResetPasswordScreen({ state = "form" }: { state?: ResetState }) {
  const [view, setView] = useState<ResetState>(state);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const r = ruleSet(pw);
  const score = pw.length === 0 ? 0 : (r.len ? 1 : 0) + (r.mix ? 1 : 0) + (r.long ? 1 : 0) + (r.len && /[^a-zA-Z0-9]/.test(pw) ? 1 : 0);
  const match = again.length > 0 && pw === again;
  const ok = r.len && match;
  return (
    <Shell top={RECOVER_TOP} headline={view === "done" ? <>You are all set.</> : RECOVER_PANEL.headline} sub={view === "done" ? "Log in with your new password. Your reports and scores are right where you left them." : RECOVER_PANEL.sub} talent>
      <style>{recoverCss}</style>
      {view === "form" && (
        <>
          <div className="hx-rc-ico"><Icon d={LOCK} /></div>
          <h1>Choose a new password</h1>
          <p>Pick something strong. You will use it on every login.</p>
          <form className="hx-form" onSubmit={(e) => { e.preventDefault(); if (ok) setView("done"); }}>
            <div>
              <label className="hx-lab">
                <span>New password</span>
                <span className="hx-pw"><input className="hx-in" type="password" placeholder="••••••••" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></span>
              </label>
              <div className="hx-rc-meter" aria-hidden="true">{[0, 1, 2, 3].map((n) => <i key={n} className={n < score ? "on" : ""} />)}</div>
            </div>
            <ul className="hx-rc-rules">
              <li className={r.len ? "ok" : ""}>At least 8 characters</li>
              <li className={r.mix ? "ok" : ""}>A letter and a number</li>
            </ul>
            <span className="hx-hint" style={{ marginTop: -6 }}>We also check it against known data breaches.</span>
            <div>
              <label className="hx-lab">
                <span>Confirm password</span>
                <span className="hx-pw"><input className="hx-in" type="password" placeholder="Re-enter the password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></span>
              </label>
              {again.length > 0 && !match && <div className="hx-rc-err">Passwords do not match.</div>}
            </div>
            <button type="submit" className="hx-btn" disabled={!ok} style={ok ? undefined : { opacity: 0.45, cursor: "not-allowed" }}>Update password</button>
          </form>
          <div className="hx-rc-timer"><span aria-hidden="true">◷</span> This link expires in 24:10</div>
        </>
      )}
      {(view === "expired" || view === "used") && (
        <>
          <div className="hx-rc-ico bad"><Icon d={LINK_OFF} /></div>
          <h1>{view === "expired" ? "This link has expired" : "This link was already used"}</h1>
          <p>{view === "expired" ? "Reset links last 30 minutes. Request a new one and we will send it right away." : "Each reset link works once. Request a fresh one to change your password again."}</p>
          <div className="hx-rc-cta">
            <a data-no-underline className="hx-btn" href="/forgot-password">Send a new link</a>
            <a data-no-underline className="hx-rc-link" href="/login">Back to log in</a>
          </div>
          {view === "used" && <div className="hx-rc-note">If you did not reset your password, secure your account now: request a new link and choose a password only you know, then email hello@hirestepx.com.</div>}
        </>
      )}
      {view === "done" && (
        <>
          <div className="hx-rc-ico ok"><Icon d={CHECK} /></div>
          <h1>Password updated</h1>
          <p>You have been signed out everywhere else. Log in with your new password to continue.</p>
          <div className="hx-rc-cta"><a data-no-underline className="hx-btn" href="/login">Log in</a></div>
        </>
      )}
    </Shell>
  );
}
