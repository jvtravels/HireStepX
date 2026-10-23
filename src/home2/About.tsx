"use client";
import { Close, Shell } from "./Pages";
import { delay, useReveal } from "./motion";

const BELIEFS = [
  { n: "01", t: "Practice should feel like the real thing", d: "You talk, we listen. A real voice asks, you answer out loud, and nobody pretends typing into a box is the same as being on the spot." },
  { n: "02", t: "Feedback should be specific, not polite", d: "A vague 7 out of 10 teaches nothing. We show you what worked, what was missing and a stronger way to say it, answer by answer." },
  { n: "03", t: "Built for how India hires", d: "Campus rounds, service-company screens, product-company loops, salary talks. Priced in rupees, and UPI works the way you expect it to." },
  { n: "04", t: "Your data is yours", d: "Your resume and your sessions are used to help you practice. You can export or delete your account whenever you like." },
];

const ROUNDS = [
  { q: "Tell me about yourself.", a: "The one everyone fumbles, so it is the first thing we help you tighten." },
  { q: "Why should we hire you?", a: "Short, specific and believable beats loud and generic." },
  { q: "Where do you see yourself in five years?", a: "Honest answers land better than rehearsed ones. We will help you find yours." },
  { q: "What is your expected salary?", a: "Yes, you can practice this one too, out loud, before it counts." },
];

const NEVER = [
  "Fake countdown timers or invented scarcity",
  "Made-up reviews and borrowed logos",
  "Scores that flatter you instead of helping you",
  "Hiding the cancel button",
];

const aboutCss = `
.ab-hero { padding-bottom: 0; }
.ab-hero > .hx-wrap { text-align: center; }
.ab-hero .cx-h1 { max-width: 20ch; margin-left: auto; margin-right: auto; text-wrap: balance; }
.ab-hero .cx-lede { max-width: 58ch; margin-left: auto; margin-right: auto; }
.ab-wave { display: flex; justify-content: center; align-items: center; gap: 5px; height: 44px; margin: 36px auto 0; }
.ab-wave i { display: block; width: 5px; border-radius: 3px; background: currentColor; opacity: .55; height: 10px; animation: ab-bar 1.6s ease-in-out infinite; }
@keyframes ab-bar { 0%, 100% { height: 10px; } 50% { height: 40px; } }
@media (prefers-reduced-motion: reduce) { .ab-wave i { animation: none; height: 22px; } }
.ab-sec { padding: 96px 0 0; }
.ab-sec > .hx-wrap > h2 { max-width: 22ch; text-wrap: balance; }
.ab-sub { margin: 14px 0 0; max-width: 60ch; font-size: 16px; line-height: 1.6; opacity: .72; }
.ab-story { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; margin-top: 36px; }
.ab-story p { margin: 0 0 16px; font-size: 16px; line-height: 1.7; max-width: 60ch; opacity: .82; }
.ab-story > * { min-width: 0; }
.ab-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 36px; }
.ab-card { border: 1px solid rgba(127,127,127,.28); border-radius: 18px; padding: 28px; display: grid; gap: 10px; align-content: start; }
.ab-card b { font-size: 12px; letter-spacing: .12em; opacity: .55; font-weight: 600; }
.ab-card h3 { margin: 0; font-size: 20px; line-height: 1.3; font-weight: 600; text-wrap: balance; }
.ab-card p { margin: 0; font-size: 15px; line-height: 1.6; opacity: .75; }
.ab-qa { display: grid; gap: 12px; margin-top: 36px; }
.ab-q { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 32px; align-items: baseline; border-bottom: 1px solid rgba(127,127,127,.28); padding: 20px 0; }
.ab-q > * { min-width: 0; }
.ab-q h3 { margin: 0; font-size: 22px; line-height: 1.3; font-weight: 600; text-wrap: balance; }
.ab-q p { margin: 0; font-size: 15px; line-height: 1.6; opacity: .75; }
.ab-never { list-style: none; margin: 36px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 32px; }
.ab-never li { display: flex; gap: 12px; align-items: baseline; font-size: 16px; line-height: 1.5; padding: 14px 0; border-bottom: 1px solid rgba(127,127,127,.28); }
.ab-never li span { flex: none; font-weight: 700; opacity: .6; }
.ab-close { margin-top: 24px; }
@container (max-width: 900px) {
  .ab-sec { padding-top: 64px; }
  .ab-story, .ab-grid, .ab-never { grid-template-columns: minmax(0, 1fr); }
  .ab-story { gap: 0; }
  .ab-q { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .ab-q h3 { font-size: 19px; }
}
`;

const BARS = [0, 2, 5, 1, 6, 3, 7, 2, 5, 0, 4, 6, 1, 3, 5, 2];

export function AboutPage() {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <Shell active="talent">
      <style>{aboutCss}</style>
      <section className="cx-hero ab-hero">
        <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
          <span className="hx-kicker hx-ri" style={delay(0)}>About us</span>
          <h1 className="cx-h1 hx-ri" style={delay(1)}>We built the practice round we wish we had.</h1>
          <p className="cx-lede hx-ri" style={delay(2)}>
            Interviews are a skill, and skills improve with reps. HireStepX is a place to rehearse out loud, get honest feedback and walk into the real room less nervous.
          </p>
          <div className="ab-wave hx-ri" style={delay(3)} aria-hidden="true">
            {BARS.map((b, i) => (
              <i key={i} style={{ animationDelay: `${b * 0.12}s` }} />
            ))}
          </div>
        </div>
      </section>

      <section className="ab-sec">
        <div className="hx-wrap">
          <span className="hx-kicker">Why we exist</span>
          <h2 className="hx-h2">Nobody teaches you how to interview.</h2>
          <div className="ab-story">
            <div>
              <p>You can study for years and still freeze on the first question. Not because you do not know your subject, but because you have never said the answer out loud to someone who is waiting for it.</p>
              <p>Friends are kind. Mock rounds are rare. Videos tell you what to say but never listen to what you said.</p>
            </div>
            <div>
              <p>So we made an interviewer that is always available, at any hour, with no judgement. It asks, listens, scores your answer and shows you a better version of it.</p>
              <p>Then it remembers what you struggled with and brings it back until it sticks. Practice a little, often, and it adds up.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ab-sec">
        <div className="hx-wrap">
          <span className="hx-kicker">What we believe</span>
          <h2 className="hx-h2">Four ideas we keep coming back to.</h2>
          <div className="ab-grid">
            {BELIEFS.map((b) => (
              <div className="ab-card" key={b.n}>
                <b>{b.n}</b>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-sec">
        <div className="hx-wrap">
          <span className="hx-kicker">Be honest</span>
          <h2 className="hx-h2">The questions you are secretly dreading.</h2>
          <p className="ab-sub">We have all been there. Here is what we say about a few of them.</p>
          <div className="ab-qa">
            {ROUNDS.map((r) => (
              <div className="ab-q" key={r.q}>
                <h3>{r.q}</h3>
                <p>{r.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-sec">
        <div className="hx-wrap">
          <span className="hx-kicker">Our promises</span>
          <h2 className="hx-h2">Things we will never do.</h2>
          <ul className="ab-never">
            {NEVER.map((n) => (
              <li key={n}><span aria-hidden="true">×</span>{n}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="cx-close ab-close">
        <Close
          kicker="Say hello"
          title="Made in Mumbai, for anyone with an interview coming up."
          body="Try a free session, or write to us at hello@hirestepx.com. A real person reads every message."
          primary={["Start a free session", "/signup"]}
          secondary={["Contact us", "/contact"]}
        />
      </div>
    </Shell>
  );
}
