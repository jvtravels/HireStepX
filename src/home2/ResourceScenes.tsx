import type { CSSProperties, ReactNode } from "react";
import type { Item } from "./resourcesData";

/* One product-style illustration per resource card: a floating UI fragment drawn from the card's own subject. */

type Pos = { l?: number | string; r?: number | string; t?: number | string; b?: number | string; w?: number | string };
const at = (p: Pos): CSSProperties => ({ left: p.l, right: p.r, top: p.t, bottom: p.b, width: p.w });

const NAME: Record<string, string> = { Tcs: "TCS", Phonepe: "PhonePe", Icici: "ICICI Bank", Goldman: "Goldman Sachs", "JP Morgan": "JP Morgan", Campus: "Campus" };
const HUE: Record<string, number> = {
  Flipkart: 250, Razorpay: 262, Swiggy: 48, Zomato: 18, Phonepe: 295, Paytm: 235, Tcs: 270, TCS: 270, Infosys: 245, Google: 145,
  Amazon: 62, Microsoft: 225, "JP Morgan": 40, Wipro: 305, Deloitte: 135, Goldman: 255, Icici: 28, Optiver: 75,
};
const hue = (co: string | undefined, fallback: number) => (co && HUE[co]) || fallback;
const nm = (co: string | undefined) => (co ? NAME[co] ?? co : "");

function Stage({ h1, h2 = h1 + 70, children }: { h1: number; h2?: number; children: ReactNode; bare?: boolean }) {
  return (
    <span className="lb-vis sc" aria-hidden="true" style={{ ["--h1" as string]: h1, ["--h2" as string]: h2 % 360 }}>
            {children}
    </span>
  );
}
const C = ({ p, children, cls = "" }: { p: Pos; children: ReactNode; cls?: string }) => <span className={`sc-c ${cls}`} style={at(p)}>{children}</span>;
const Ln = ({ w = "100%", s = "" }: { w?: string; s?: "h" | "m" | "" }) => <i className={`sc-ln ${s}`} style={{ width: w }} />;
const Ch = ({ children, t = "" }: { children: ReactNode; t?: "g" | "o" | "d" | "r" | "" }) => <b className={`sc-ch ${t}`}>{children}</b>;
const Mono = ({ co, h, sz = 26 }: { co: string; h: number; sz?: number }) => (
  <span className="sc-mono" style={{ width: sz, height: sz, fontSize: sz * 0.46, background: `oklch(0.5 0.16 ${h})` }}>{nm(co).charAt(0)}</span>
);
const Row = ({ children, g = 8 }: { children: ReactNode; g?: number }) => <span className="sc-row" style={{ gap: g }}>{children}</span>;
const T = ({ children }: { children: ReactNode }) => <span className="sc-t">{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span className="sc-s">{children}</span>;
const Ring = ({ pct, label, sz = 40, tone = "var(--btn)" }: { pct: number; label: string; sz?: number; tone?: string }) => (
  <span className="sc-ringw" style={{ width: sz, height: sz }}>
    <svg viewBox="0 0 36 36" width={sz} height={sz}>
      <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(0.93 0.01 285)" strokeWidth="4" />
      <circle cx="18" cy="18" r="15" fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} transform="rotate(-90 18 18)" />
    </svg>
    <b>{label}</b>
  </span>
);
const Bars = ({ v, h = 38, tone }: { v: number[]; h?: number; tone?: string }) => (
  <span className="sc-bars" style={{ height: h }}>{v.map((x, n) => <i key={n} style={{ height: `${x}%`, background: tone }} />)}</span>
);
const Av = ({ h, sz = 22, face }: { h: number; sz?: number; face?: boolean }) => (
  <span className="sc-av" style={{ width: sz, height: sz, background: `oklch(0.86 0.07 ${h})` }}>
    <svg viewBox="0 0 24 24" width={sz} height={sz}><circle cx="12" cy="9.5" r="4" fill={`oklch(0.55 0.1 ${h})`} /><path d="M4 22c0-4.5 3.6-7 8-7s8 2.5 8 7" fill={`oklch(0.55 0.1 ${h})`} />{face ? <circle cx="12" cy="9.5" r="1.2" fill="#fff" /> : null}</svg>
  </span>
);
const Check = ({ on = true }: { on?: boolean }) => (
  <span className={`sc-ck${on ? " on" : ""}`}>{on ? <svg viewBox="0 0 12 12" width="9" height="9"><path d="m2.5 6.2 2.2 2.2 4.8-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}</span>
);

/* ── Company interview loop ── */
const ROUNDS: Record<string, string[]> = {
  Flipkart: ["Online test", "Machine coding", "System design", "Hiring manager"],
  Razorpay: ["Screening call", "Machine coding", "System design", "Culture fit"],
  Swiggy: ["Online test", "DSA round", "Low level design", "Managerial"],
  Zomato: ["Take-home task", "DSA round", "System design", "Culture round"],
  Phonepe: ["Online test", "DSA round", "System design", "Hiring manager"],
  Paytm: ["Screening", "DSA round", "Design round", "HR round"],
  Tcs: ["NQT test", "Technical", "Managerial", "HR round"],
  Infosys: ["Aptitude test", "Technical", "HR round", "Offer"],
  Google: ["Phone screen", "Coding x2", "System design", "Googleyness"],
  Amazon: ["Online assessment", "Coding round", "Design round", "Bar raiser"],
};
function Loop({ i }: { i: Item }) {
  const co = i.co ?? "";
  const h = hue(co, 270);
  const r = ROUNDS[co] ?? ["Screening", "Technical", "Managerial", "HR round"];
  const now = co.length % 3;
  return (
    <Stage h1={h}>
      <C p={{ l: "7%", t: 14, w: "56%" }} cls="f">
        <Row><Mono co={co} h={h} sz={24} /><span className="sc-col"><T>{nm(co)}</T><S>Interview loop</S></span></Row>
        <span className="sc-steps">
          {r.map((x, n) => (
            <span key={x} className={n < now ? "done" : n === now ? "now" : ""}><u />{x}</span>
          ))}
        </span>
      </C>
      <C p={{ r: "6%", t: 16 }} cls="f2"><Ch t="g">4 rounds</Ch></C>
      <C p={{ r: "6%", b: 14 }} cls="f2"><Row g={5}><Check /><S>Offer</S></Row></C>
    </Stage>
  );
}

/* ── Interviewer question bubble ── */
function Bubble({ q, chips, h, extra, who = "Interviewer", hi }: { q: string; chips: [string, ("g" | "o" | "d" | "r" | "")?][]; h: number; extra?: ReactNode; who?: string; hi?: string }) {
  const chipRow = <Row g={4}>{chips.map(([c, t]) => <Ch key={c} t={t}>{c}</Ch>)}</Row>;
  return (
    <Stage h1={h}>
      <C p={{ l: "7%", t: 10, w: "72%" }} cls="f">
        <Row><Av h={h} sz={18} /><S>{who}</S></Row>
        <span className="sc-q">{hi ? <><mark>{hi}</mark> {q}</> : q}</span>
        {extra ? chipRow : null}
      </C>
      {extra ?? (
        <C p={{ r: "6%", b: 12, w: "48%" }} cls="f2">
          <Ln w="92%" s="m" />
          {chipRow}
        </C>
      )}
    </Stage>
  );
}

/* ── Code ── */
const K = ({ c, children }: { c: "k" | "f" | "s" | "c" | "n"; children: ReactNode }) => <span className={`ck-${c}`}>{children}</span>;
function CodeCard({ file, lines, h, chip, tail }: { file: string; lines: ReactNode[]; h: number; chip: string; tail?: ReactNode }) {
  return (
    <Stage h1={h}>
      <C p={{ l: "9%", t: 16, w: "66%" }} cls="f">
        <Row><span className="sc-dots"><i /><i /><i /></span><S>{file}</S></Row>
        <span className="sc-code">{lines.map((l, n) => <span key={n}>{l}{"\n"}</span>)}</span>
      </C>
      <C p={{ r: "6%", b: 22 }} cls="f2"><Ch t="g">{chip}</Ch></C>
      {tail}
    </Stage>
  );
}

/* ── Issue tree / boxes ── */
const Box = ({ children, on }: { children: ReactNode; on?: boolean }) => <span className={`sc-box${on ? " on" : ""}`}>{children}</span>;

/* ── Cities ── */
const SKY: Record<string, ReactNode> = {
  bengaluru: <path d="M0 50V34h10V22h8v12h6V14h10v36h6V28h8v22h4V30c0-9 12-9 12 0v20h6V24h8v26h8V32h8v18z" />,
  hyderabad: <path d="M0 50V38h8V30h6v8h6V16h5V8h4v8h5v22h6V16h5V8h4v8h5v22h6V30h6v8h8v12zM30 50V36a5 5 0 0 1 10 0v14zM66 50V36a5 5 0 0 1 10 0v14z" />,
  pune: <path d="M0 50V36l14-14 12 12 14-20 16 22 12-10 16 14 12-8v18z" />,
  chennai: <path d="M0 50v-6h20v-6h14v-6h12v-6h10v-6h8v6h10v6h12v6h14v6h20v6z" />,
  mumbai: <path d="M0 44c10 4 20 4 30 0s20-4 30 0 20 4 30 0 20-4 30 0v6H0zM68 44V6h3v38zM71 8 20 44M71 8 118 44M71 14 36 44M71 14 104 44M71 20 52 44M71 20 90 44" stroke="currentColor" strokeWidth="1.2" fill="currentColor" />,
  "delhi-ncr": <path d="M0 50V40h14V28h6V40h8V30h8V50zM54 50V22h6V12h40v10h6v28h-8V30a22 22 0 0 0-36 0v20z" />,
};
function City({ i }: { i: Item }) {
  const slug = i.h.split("/").pop() ?? "";
  const city = i.t.replace("Interview prep in ", "").replace(/ \(.*\)/, "");
  const n = (i.d ?? "").match(/^(\d+)/)?.[1] ?? "";
  const h = ({ bengaluru: 150, hyderabad: 30, pune: 165, chennai: 20, mumbai: 215, "delhi-ncr": 300 } as Record<string, number>)[slug] ?? 190;
  return (
    <Stage h1={h} bare>
      <i className="sc-sun" />
      <C p={{ l: "6%", t: 16, w: "50%" }} cls="f">
        <Row><span className="sc-pinb" /><T>{city}</T></Row>
        <Row g={4}><Ch>SDE</Ch><Ch>PM</Ch><Ch>Data</Ch></Row>
      </C>
      <C p={{ r: "8%", t: 56 }} cls="f2"><Row g={5}><b className="sc-big">{n}</b><S>companies<br />hiring</S></Row></C>
      <svg className="sc-sky" viewBox="0 0 120 50" preserveAspectRatio="xMidYMax meet" fill="currentColor">{SKY[slug] ?? SKY.bengaluru}</svg>
    </Stage>
  );
}

/* ── Registry ── */
const GRID16 = Array.from({ length: 16 }, (_, n) => n);

function sceneFor(i: Item): ReactNode {
  const h = i.h;
  switch (h) {
    /* topics */
    case "/ai-mock-interview":
      return <Stage h1={278}><C p={{ l: "9%", t: 14, w: "64%" }} cls="f"><Row><Ch t="g">Listening</Ch><S>Q 3 of 8</S></Row><Bars v={[30, 55, 80, 45, 95, 60, 85, 40, 70, 50, 62, 35, 74, 48]} h={40} /><Ln w="80%" /></C><C p={{ r: "7%", t: 82 }} cls="f2"><Row><Ring pct={82} label="82" /><span className="sc-col"><T>Score</T><S>Clear, structured</S></span></Row></C></Stage>;
    case "/interview-anxiety":
      return <Stage h1={195} bare><i className="sc-breath"><u /><u /><u /></i><C p={{ l: "8%", t: 18 }} cls="f"><T>Breathe in</T><S>4 seconds</S></C><C p={{ r: "8%", b: 20 }} cls="f2"><Row g={6}><span className="sc-pulse" /><S>Heart rate steady</S></Row></C></Stage>;
    case "/english-interview-practice":
      return <Stage h1={330}><C p={{ l: "8%", t: 16, w: "72%" }} cls="f"><S>You said</S><span className="sc-q">I am <s>having</s> <mark>have</mark> three years of experience.</span><Row g={4}><Ch t="g">Grammar fixed</Ch><Ch>Pace 128 wpm</Ch></Row></C><C p={{ r: "8%", b: 18 }} cls="f2"><Row><Ring pct={90} label="90" sz={34} tone="oklch(0.6 0.15 160)" /><S>Clarity</S></Row></C></Stage>;
    case "/telephonic-interview-questions":
      return <Stage h1={215}><C p={{ l: "20%", t: 14, w: "60%" }} cls="f"><Row><Av h={215} sz={30} face /><span className="sc-col"><T>Recruiter</T><S>Phone interview</S></span></Row><span className="sc-time">04:12</span><Row g={8}><i className="sc-btn">mute</i><i className="sc-btn end">end</i></Row></C></Stage>;
    case "/walk-in-interview-preparation":
      return <Stage h1={60}><C p={{ l: "12%", t: 14, w: "58%" }} cls="f"><T>Walk-in kit</T>{[["Resume copies", true], ["ID proof", true], ["Passport photos", true], ["Certificates", false]].map(([x, on]) => <Row key={String(x)} g={7}><Check on={Boolean(on)} /><S>{x}</S></Row>)}</C><C p={{ r: "8%", b: 20 }} cls="f2"><Ch t="o">Reach by 9:00</Ch></C></Stage>;
    case "/one-way-video-interview-practice":
      return <Stage h1={25}><C p={{ l: "14%", t: 12, w: "60%" }} cls="f vid"><span className="sc-frame"><Av h={25} sz={46} face /></span><Row><span className="sc-rec" /><S>REC</S><S>01:30 left</S></Row></C><C p={{ r: "6%", b: 22 }} cls="f2"><Ch>Retake 1 of 2</Ch></C></Stage>;
    case "/bpo-interview-questions":
      return <Stage h1={180}><C p={{ l: "9%", t: 14, w: "62%" }} cls="f"><Row><Ch t="d">Voice round</Ch><S>02:40</S></Row>{[["Pace", 72], ["Clarity", 88], ["Empathy", 64]].map(([x, v]) => <span key={String(x)} className="sc-meter"><S>{x}</S><u><i style={{ width: `${v}%` }} /></u></span>)}</C><C p={{ r: "6%", b: 20 }} cls="f2"><Av h={180} sz={26} face /></C></Stage>;
    case "/bank-po-interview-questions":
      return <Stage h1={90}><C p={{ l: "8%", t: 12, w: "56%" }} cls="f"><span className="sc-news"><b>RBI holds repo rate</b><Ln /><Ln w="70%" /></span></C><C p={{ r: "7%", t: 58, w: "52%" }} cls="f2"><span className="sc-news"><b>Union Budget: banking</b><Ln /><Ln w="60%" /></span><Row g={4}><Ch>Banking</Ch><Ch t="o">Current affairs</Ch></Row></C></Stage>;
    case "/mba-personal-interview-preparation":
      return <Stage h1={300}><C p={{ l: "10%", t: 12, w: "62%" }} cls="f"><Row g={-4}><Av h={300} sz={24} /><Av h={20} sz={24} /><Av h={160} sz={24} /></Row><span className="sc-q">&ldquo;Why an MBA, and why now?&rdquo;</span></C><C p={{ r: "7%", b: 22 }} cls="f2"><Ch>PI panel of 3</Ch></C></Stage>;
    case "/candidates":
      return <Stage h1={235}><C p={{ l: "9%", t: 14, w: "66%" }} cls="f"><Row><span className="sc-cap"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M2 9l10-5 10 5-10 5zM6 11.5V16c1.6 1.6 3.6 2.2 6 2.2s4.4-.6 6-2.2v-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg></span><T>Campus roadmap</T></Row><span className="sc-steps h">{["Year 1", "Year 2", "Year 3", "Placement"].map((x, n) => <span key={x} className={n < 2 ? "done" : n === 2 ? "now" : ""}><u />{x}</span>)}</span></C></Stage>;
    case "/interview-prep":
      return <Stage h1={278}><C p={{ l: "8%", t: 16, w: "70%" }} cls="f"><T>Prep framework</T><span className="sc-steps h">{["Resume", "Practise", "Mock", "Offer"].map((x, n) => <span key={x} className={n < 2 ? "done" : n === 2 ? "now" : ""}><u />{x}</span>)}</span></C><C p={{ r: "7%", b: 22 }} cls="f2"><Ring pct={64} label="64%" sz={38} /></C></Stage>;
    case "/companies":
      return <Stage h1={250}><C p={{ l: "9%", t: 14, w: "70%" }} cls="f"><T>Company library</T><span className="sc-tiles">{["Flipkart", "Razorpay", "Swiggy", "Tcs", "Google", "Amazon"].map((c) => <Mono key={c} co={c} h={hue(c, 270)} sz={30} />)}</span></C></Stage>;
    case "/salary-report-2026":
      return <Stage h1={70}><C p={{ l: "9%", t: 14, w: "70%" }} cls="f"><Row><T>CTC bands</T><Ch t="o">2026</Ch></Row>{[["Startup", 62], ["Product", 88], ["Services", 40], ["Fintech", 74]].map(([x, v]) => <span key={String(x)} className="sc-meter"><S>{x}</S><u><i style={{ width: `${v}%`, background: "oklch(0.7 0.13 60)" }} /></u></span>)}</C><C p={{ r: "6%", b: 18 }} cls="f2"><Ch>Sources cited</Ch></C></Stage>;

    /* company pages */
    case "/companies/flipkart": case "/companies/razorpay": case "/companies/swiggy": case "/companies/zomato": case "/companies/phonepe":
    case "/companies/paytm": case "/companies/tcs": case "/companies/infosys": case "/companies/google": case "/companies/amazon":
      return <Loop i={i} />;

    /* salary guides */
    case "/blog/python-developer-salary-india-2026":
      return <CodeCard h={60} file="salary.py" chip="Fresher to senior" lines={[<><K c="k">for</K> level <K c="k">in</K> levels:</>, <>{"  "}<K c="f">print</K>(level, band)</>, <><K c="c"># fresher</K> {"▁▁"} <K c="c"># senior</K> {"▁▁▁▁▁▁"}</>]} />;
    case "/blog/data-analyst-salary-india-2026":
      return <Stage h1={70}><C p={{ l: "9%", t: 14, w: "64%" }} cls="f"><T>By city</T><Bars v={[78, 70, 58, 52, 46, 40]} h={46} tone="oklch(0.72 0.12 60)" /><span className="sc-axis"><S>BLR</S><S>MUM</S><S>HYD</S><S>PUN</S><S>CHN</S><S>NCR</S></span></C><C p={{ r: "6%", b: 20 }} cls="f2"><Ch t="o">Entry to senior</Ch></C></Stage>;
    case "/blog/react-developer-salary-india-2026":
      return <Stage h1={215}><C p={{ l: "9%", t: 16, w: "66%" }} cls="f"><Row><span className="sc-react">&lt;/&gt;</span><T>React developer</T></Row><span className="sc-slide"><u><i /></u><S>0 yrs</S><S>4 yrs</S><S>8+ yrs</S></span></C><C p={{ r: "6%", b: 20 }} cls="f2"><Ch>By experience and city</Ch></C></Stage>;
    case "/blog/fresher-salary-india-2026":
      return <Stage h1={50}><C p={{ l: "10%", t: 14, w: "58%" }} cls="f"><Row><Av h={50} sz={24} face /><span className="sc-col"><T>Offer letter</T><S>Fresher, 2026 batch</S></span></Row><Ln /><Ln w="75%" /><Row g={5}><Ch t="g">Fixed</Ch><Ch>Variable</Ch><Ch>Joining</Ch></Row></C><C p={{ r: "6%", b: 18 }} cls="f2"><Ch t="o">Negotiate</Ch></C></Stage>;

    /* questions */
    case "/questions/flipkart-pm-interview-questions":
      return <Bubble h={250} q="Design a feature to cut cart abandonment on Flipkart." chips={[["Case study", "d"], ["PM"]]} extra={<C p={{ r: "6%", b: 12 }} cls="f2"><span className="sc-funnel"><i style={{ width: 52 }} /><i style={{ width: 38 }} /><i style={{ width: 22 }} /></span></C>} />;
    case "/questions/flipkart-sde-interview-questions":
      return <Stage h1={250}><C p={{ l: "8%", t: 14, w: "70%" }} cls="f"><S>System design</S><span className="sc-q">Build the Big Billion Days flash sale.</span><span className="sc-arch"><Box>Client</Box><em /><Box on>Queue</Box><em /><Box>Stock DB</Box></span></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch t="d">SDE</Ch></C></Stage>;
    case "/questions/tcs-nqt-interview-questions":
      return <Stage h1={270}><C p={{ l: "9%", t: 14, w: "64%" }} cls="f"><Row><T>NQT sections</T><Ch t="o">2026</Ch></Row>{[["Numerical", 70], ["Verbal", 55], ["Reasoning", 80], ["Coding", 40]].map(([x, v]) => <span key={String(x)} className="sc-meter"><S>{x}</S><u><i style={{ width: `${v}%` }} /></u></span>)}</C><C p={{ r: "6%", b: 18 }} cls="f2"><Ch>Eligibility</Ch></C></Stage>;
    case "/questions/tcs-ninja-interview-questions":
      return <CodeCard h={270} file="ninja.py" chip="Technical round" lines={[<><K c="k">def</K> <K c="f">reverse</K>(head):</>, <>{"  "}prev = <K c="k">None</K></>, <>{"  "}<K c="k">while</K> head:</>, <>{"    "}head.next, prev = prev, head</>]} />;
    case "/questions/tcs-hr-round-questions":
      return <Bubble h={270} q="Are you comfortable relocating for the role?" chips={[["HR round", "d"], ["Fresher"]]} extra={<C p={{ r: "6%", b: 12 }} cls="f2"><Row g={5}><Check /><S>Honest, with a reason</S></Row></C>} />;
    case "/questions/infosys-campus-interview-questions":
      return <Bubble h={245} q="Why Infosys, and what do you know about InfyTQ?" chips={[["Campus", "d"], ["HR + tech"]]} who="Campus panel" extra={<C p={{ r: "6%", b: 12 }} cls="f2"><Row g={4}><Ch>Aptitude</Ch><Ch>Tech</Ch><Ch t="g">HR</Ch></Row></C>} />;
    case "/questions/amazon-leadership-principles-interview":
      return <Bubble h={62} q="Tell me about a time you disagreed with your manager." chips={[["Have Backbone", "o"], ["STAR"]]} hi="Q:" extra={<C p={{ r: "6%", b: 12 }} cls="f2"><Row g={4}>{["S", "T", "A", "R"].map((x) => <Ch key={x} t="d">{x}</Ch>)}</Row></C>} />;
    case "/questions/amazon-sde-leadership-principles-interview":
      return <Bubble h={62} q="Describe cutting API latency under a hard deadline." chips={[["Deliver Results", "o"], ["SDE"]]} who="Bar raiser" extra={<C p={{ r: "6%", b: 12 }} cls="f2"><Row g={5}><S>p99</S><b className="sc-big">480ms</b><S>to 120ms</S></Row></C>} />;
    case "/questions/salary-negotiation-india-tech":
      return <Stage h1={290}><C p={{ l: "8%", t: 12, w: "62%" }} cls="f"><span className="sc-msg"><S>Recruiter</S>We can offer the base we discussed.</span></C><C p={{ r: "6%", t: 80, w: "62%" }} cls="f2 me"><span className="sc-msg"><S>You</S>Can we revisit the fixed component?</span><Row g={4}><Ch t="g">Counter</Ch><Ch>Market data</Ch></Row></C></Stage>;
    case "/questions/deloitte-consulting-case-interview":
      return <Stage h1={135}><C p={{ l: "7%", t: 12, w: "76%" }} cls="f"><Row><Ch t="d">Case</Ch><S>Profit is falling</S></Row><span className="sc-tree"><Box on>Profit</Box><span><Box>Revenue</Box><Box>Cost</Box></span><span><Box>Price</Box><Box>Volume</Box><Box>Fixed</Box><Box>Variable</Box></span></span></C></Stage>;
    case "/questions/goldman-sachs-interview-questions-india":
      return <Stage h1={255}><C p={{ l: "8%", t: 12, w: "62%" }} cls="f"><S>Finance round</S><span className="sc-q">Walk me through a DCF.</span><Bars v={[30, 42, 55, 66, 78, 90]} h={34} tone="oklch(0.55 0.14 255)" /></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch t="d">Analyst</Ch></C></Stage>;
    case "/questions/why-should-we-hire-you-answer-india":
      return <Stage h1={160}><C p={{ l: "8%", t: 12, w: "74%" }} cls="f"><T>Why should we hire you?</T><span className="sc-pillars">{[["Skills", 80], ["Attitude", 65], ["Fit", 72]].map(([x, v]) => <span key={String(x)}><i style={{ height: `${v}%` }} /><S>{x}</S></span>)}</span></C><C p={{ r: "6%", b: 14 }} cls="f2"><Ch t="g">60 sec answer</Ch></C></Stage>;
    case "/questions/icici-relationship-manager-interview-questions":
      return <Stage h1={28}><C p={{ l: "8%", t: 12, w: "62%" }} cls="f"><S>Sales round</S><span className="sc-q">Sell me a savings account.</span><span className="sc-steps h">{["Lead", "Meet", "Account"].map((x, n) => <span key={x} className={n < 2 ? "done" : "now"}><u />{x}</span>)}</span></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch t="o">Targets</Ch></C></Stage>;
    case "/questions/optiver-quant-interview-questions":
      return <Stage h1={75}><C p={{ l: "8%", t: 12, w: "66%" }} cls="f"><S>Probability</S><span className="sc-q">Expected flips to get two heads in a row?</span><Row g={5}>{["H", "T", "H", "H"].map((x, n) => <span key={n} className={`sc-coin${x === "H" ? " h" : ""}`}>{x}</span>)}<S>E = 6</S></Row></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch t="d">Quant</Ch></C></Stage>;

    /* guides */
    case "/blog/flipkart-interview-prep-guide":
      return <Stage h1={250}><C p={{ l: "9%", t: 14, w: "66%" }} cls="f"><Row><Mono co="Flipkart" h={250} sz={22} /><T>Flipkart prep guide</T></Row><Ln s="h" w="86%" /><Ln /><span className="sc-tip"><b>Tip</b> Practise machine coding in 90 minutes.</span></C><C p={{ r: "5%", b: 16 }} cls="f2"><Ch>10 min read</Ch></C></Stage>;
    case "/blog/resume-tips-freshers-india-2026":
      return <Stage h1={50}><C p={{ l: "9%", t: 12, w: "50%" }} cls="f"><Ln s="h" w="60%" /><Ln /><span className="sc-hl"><Ln w="100%" s="m" /></span><Ln w="80%" /><Ln w="66%" /></C><C p={{ r: "7%", t: 40 }} cls="f2"><Row><Ring pct={86} label="86" sz={38} tone="oklch(0.6 0.15 160)" /><span className="sc-col"><T>ATS score</T><S>Shortlisted</S></span></Row></C></Stage>;
    case "/blog/microsoft-india-interview-questions-2026":
      return <CodeCard h={225} file="Microsoft" chip="SDE and PM" lines={[<><K c="c">// SDE</K></>, <><K c="k">int</K> <K c="f">lru</K>(<K c="k">int</K> key)</>, <><K c="c">// PM: size the market</K></>]} tail={<C p={{ l: "9%", b: 12, w: "40%" }} cls="f2"><Row g={5}><Mono co="Microsoft" h={225} sz={18} /><S>India</S></Row></C>} />;
    case "/blog/jp-morgan-interview-questions-india-2026":
      return <Stage h1={40}><C p={{ l: "9%", t: 12, w: "62%" }} cls="f"><Row><Mono co="JP Morgan" h={40} sz={22} /><T>JP Morgan</T></Row><Bars v={[40, 55, 48, 70, 62, 85]} h={36} tone="oklch(0.55 0.1 40)" /></C><C p={{ r: "6%", b: 16 }} cls="f2"><Row g={4}><Ch>SDE</Ch><Ch>Analyst</Ch><Ch t="d">Quant</Ch></Row></C></Stage>;
    case "/blog/behavioral-interview-questions-freshers":
      return <Stage h1={285}><C p={{ l: "9%", t: 12, w: "68%" }} cls="f"><Row><b className="sc-big">50</b><T>behavioural questions</T></Row>{["Tell me about a team conflict", "A time you failed", "Leading a project"].map((x) => <Row key={x} g={6}><Check on={false} /><S>{x}</S></Row>)}</C><C p={{ r: "6%", b: 14 }} cls="f2"><Ch>Campus</Ch></C></Stage>;
    case "/blog/tcs-interview-questions-freshers-2026":
      return <Stage h1={270}><C p={{ l: "9%", t: 12, w: "62%" }} cls="f"><Row><Mono co="Tcs" h={270} sz={22} /><T>TCS freshers</T></Row><span className="sc-steps h">{["NQT", "Tech", "MR", "HR"].map((x, n) => <span key={x} className={n < 1 ? "done" : n === 1 ? "now" : ""}><u />{x}</span>)}</span></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch>2026 batch</Ch></C></Stage>;
    case "/blog/infosys-interview-questions-2026":
      return <Stage h1={245}><C p={{ l: "9%", t: 12, w: "58%" }} cls="f"><Row><Mono co="Infosys" h={245} sz={22} /><T>InfyTQ</T></Row><span className="sc-cert"><b>Certified</b><S>Power Programmer track</S></span></C><C p={{ r: "6%", b: 16 }} cls="f2"><Row g={4}><Ch t="g">Specialist</Ch><Ch>DSE</Ch></Row></C></Stage>;
    case "/blog/wipro-interview-questions-answers":
      return <Stage h1={305}><C p={{ l: "9%", t: 12, w: "62%" }} cls="f"><Row><Mono co="Wipro" h={305} sz={22} /><T>Wipro hiring</T></Row><Row g={5}><Ch t="d">Elite NTH</Ch><Ch>Turbo</Ch></Row><Ln w="78%" /><Ln w="54%" /></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch t="g">Q&amp;A</Ch></C></Stage>;
    case "/blog/top-10-google-interview-questions":
      return <Stage h1={145}><C p={{ l: "9%", t: 12, w: "70%" }} cls="f"><Row><Mono co="Google" h={145} sz={22} /><T>Top 10 questions</T></Row><span className="sc-nums">{Array.from({ length: 10 }, (_, n) => <i key={n} className={n === 3 ? "on" : ""}>{n + 1}</i>)}</span></C></Stage>;
    case "/blog/hr-interview-questions-answers-india":
      return <Stage h1={320}><C p={{ l: "9%", t: 12, w: "66%" }} cls="f"><Row><b className="sc-big">30</b><T>HR questions</T></Row>{["Why this company?", "Where in 5 years?", "Notice period?"].map((x, n) => <Row key={x} g={6}><Check on={n < 2} /><S>{x}</S></Row>)}</C></Stage>;
    case "/blog/amazon-leadership-principles-interview":
      return <Stage h1={62}><C p={{ l: "9%", t: 10, w: "62%" }} cls="f"><Row><Mono co="Amazon" h={62} sz={18} /><T>16 principles</T></Row><span className="sc-grid16">{GRID16.map((n) => <i key={n} className={n === 0 ? "on" : ""} />)}</span></C><C p={{ r: "6%", b: 12 }} cls="f2"><Ch t="o">Customer Obsession</Ch></C></Stage>;
    case "/blog/how-to-introduce-yourself-in-interview":
      return <Stage h1={195}><C p={{ l: "9%", t: 14, w: "64%" }} cls="f"><span className="sc-name"><S>HELLO</S><b>my name is</b><em>Aarav</em></span><Ln /><Ln w="72%" /></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch>Script + examples</Ch></C></Stage>;
    case "/blog/tell-me-about-yourself-best-answer":
      return <Stage h1={300}><C p={{ l: "8%", t: 12, w: "72%" }} cls="f"><Row><T>Tell me about yourself</T></Row><span className="sc-q"><mark>Present</mark>, then <mark>past</mark>, then <mark>future</mark>.</span></C><C p={{ r: "6%", b: 14 }} cls="f2"><Row><Ring pct={60} label="60s" sz={36} /></Row></C></Stage>;
    case "/blog/system-design-interview-preparation":
      return <Stage h1={240}><C p={{ l: "7%", t: 10, w: "78%" }} cls="f"><S>Design a URL shortener</S><span className="sc-arch big"><Box>Client</Box><em /><Box>LB</Box><em /><Box on>API</Box><em /><Box>Cache</Box></span><span className="sc-arch big"><span /><span /><Box>DB</Box></span></C></Stage>;
    case "/blog/razorpay-interview-experience":
      return <Stage h1={262}><C p={{ l: "9%", t: 12, w: "56%" }} cls="f"><Row><Mono co="Razorpay" h={262} sz={22} /><T>My experience</T></Row><span className="sc-steps h">{["Applied", "Coding", "Design", "Offer"].map((x, n) => <span key={x} className={n < 3 ? "done" : "now"}><u />{x}</span>)}</span></C><C p={{ r: "6%", b: 14 }} cls="f2"><span className="sc-pay"><S>Pay</S><b>Razorpay</b></span></C></Stage>;
    case "/blog/salary-negotiation-tips-india":
      return <Stage h1={60}><C p={{ l: "9%", t: 12, w: "56%" }} cls="f"><S>Your offer</S><Bars v={[48, 66]} h={44} /></C><C p={{ r: "7%", t: 40 }} cls="f2"><Row><b className="sc-big g">+30%</b></Row><S>after counter</S></C></Stage>;
    case "/blog/ace-case-study-interviews":
      return <Stage h1={135}><C p={{ l: "7%", t: 12, w: "76%" }} cls="f"><Row><Ch t="d">Framework</Ch><S>MECE issue tree</S></Row><span className="sc-tree"><Box on>Problem</Box><span><Box>Market</Box><Box>Company</Box></span><span><Box>Size</Box><Box>Growth</Box><Box>Cost</Box><Box>Brand</Box></span></span></C></Stage>;
    case "/blog/dsa-60-day-preparation-plan":
      return <Stage h1={165}><C p={{ l: "8%", t: 10, w: "68%" }} cls="f"><Row><b className="sc-big">60</b><T>day plan</T></Row><span className="sc-cal">{Array.from({ length: 30 }, (_, n) => <i key={n} className={n < 19 ? "on" : n === 19 ? "now" : ""} />)}</span></C><C p={{ r: "5%", b: 12 }} cls="f2"><Ch t="g">Day 20</Ch></C></Stage>;
    case "/blog/salary-negotiation-after-offer-letter-india":
      return <Stage h1={55}><C p={{ l: "6%", t: 10, w: "42%" }} cls="f"><T>Offer letter</T><Ln /><Ln w="80%" /><Ln w="60%" /><span className="sc-sign">Aarav K.</span></C><C p={{ r: "6%", t: 46, w: "42%" }} cls="f2"><S>Reply draft</S><Ln s="m" /><Ln w="70%" /><Ch t="g">Counter sent</Ch></C></Stage>;
    case "/blog/how-to-answer-tell-me-about-yourself-india":
      return <Stage h1={285}><C p={{ l: "8%", t: 12, w: "70%" }} cls="f"><T>Tell me about yourself</T><span className="sc-dd"><span><b>Do</b><S>Role, proof, goal</S></span><span className="no"><b>Don&apos;t</b><S>Recite resume</S></span></span></C><C p={{ r: "6%", b: 14 }} cls="f2"><Ch>India guide</Ch></C></Stage>;
    case "/blog/how-to-answer-greatest-weakness-interview-india":
      return <Stage h1={25}><C p={{ l: "8%", t: 12, w: "72%" }} cls="f"><T>Greatest weakness</T><span className="sc-dd"><span className="no"><b>Weakness</b><S>Delegating</S></span><span><b>Fix</b><S>Weekly handoffs</S></span></span><span className="sc-meter"><S>Progress</S><u><i style={{ width: "66%" }} /></u></span></C></Stage>;
    case "/blog/java-developer-interview-questions-india-2026":
      return <CodeCard h={25} file="Main.java" chip="Role guide" lines={[<><K c="k">public class</K> <K c="f">Cache</K> {"{"}</>, <>{"  "}<K c="k">private</K> Map&lt;K,V&gt; store;</>, <>{"  "}<K c="k">void</K> <K c="f">put</K>(K k, V v) {"{ … }"}</>, <>{"}"}</>]} />;
    case "/blog/data-analyst-interview-questions-sql-python-business-case-india-2026":
      return <Stage h1={190}><C p={{ l: "6%", t: 12, w: "52%" }} cls="f"><span className="sc-code"><K c="k">SELECT</K> city, <K c="f">SUM</K>(sales){"\n"}<K c="k">FROM</K> orders{"\n"}<K c="k">GROUP BY</K> city;</span></C><C p={{ r: "6%", t: 56, w: "40%" }} cls="f2"><Bars v={[50, 82, 38, 64]} h={40} tone="oklch(0.62 0.13 190)" /></C></Stage>;
    default:
      return null;
  }
}

export function Scene({ i }: { i: Item }): ReactNode {
  if (i.k === "city") return <City i={i} />;
  return sceneFor(i);
}

export const sceneCss = `
.lb-card .lb-vis.sc { display: block; padding: 0; }
.sc-c { position: absolute; display: flex; flex-direction: column; gap: 7px; background: #fff; border-radius: 12px; padding: 10px 12px; box-shadow: 0 0 0 1px oklch(0.2 0.03 280 / .06), 0 12px 26px oklch(0.3 0.1 280 / .13); font-size: 11px; line-height: 1.3; color: var(--ink); transition: transform .4s cubic-bezier(0.22, 1, 0.36, 1); box-sizing: border-box; }
.sc-c.f2 { padding: 7px 10px; border-radius: 10px; }
.lb-card:hover .sc-c.f, .lb-card:focus-within .sc-c.f { transform: translateY(-3px); }
.lb-card:hover .sc-c.f2, .lb-card:focus-within .sc-c.f2 { transform: translateY(2px); }
.sc-row { display: flex; align-items: center; }
.sc-col { display: flex; flex-direction: column; gap: 2px; }
.sc-t { font-weight: 600; font-size: 12px; letter-spacing: -.005em; color: var(--ink); }
.sc-s { font-size: 10px; color: var(--ink-3); }
.sc-q { font-size: 12px; font-weight: 500; line-height: 1.4; color: var(--ink); }
.sc-q mark, .sc-code mark { background: oklch(0.93 0.09 var(--h1)); color: inherit; border-radius: 3px; padding: 0 3px; }
.sc-q s { color: var(--ink-3); text-decoration-color: oklch(0.6 0.2 25); }
.sc-ln { display: block; height: 5px; border-radius: 3px; background: oklch(0.93 0.008 285); flex: none; }
.sc-ln.h { height: 7px; background: oklch(0.82 0.02 285); }
.sc-ln.m { background: oklch(0.86 0.07 var(--h1)); }
.sc-ch { display: inline-block; font-size: 9.5px; font-weight: 600; line-height: 1; padding: 4px 7px; border-radius: 6px; white-space: nowrap; background: oklch(0.95 0.03 var(--h1)); color: oklch(0.38 0.12 var(--h1)); }
.sc-ch.g { background: oklch(0.95 0.05 160); color: oklch(0.38 0.1 160); }
.sc-ch.o { background: oklch(0.96 0.05 70); color: oklch(0.45 0.11 55); }
.sc-ch.d { background: var(--btn); color: #fff; }
.sc-ch.r { background: oklch(0.95 0.04 25); color: oklch(0.45 0.15 25); }
.sc-mono { display: grid; place-items: center; border-radius: 8px; color: #fff; font-weight: 700; flex: none; }
.sc-av { display: block; border-radius: 50%; overflow: hidden; flex: none; border: 2px solid #fff; box-sizing: content-box; }
.sc-av svg { display: block; }
.sc-ringw { position: relative; display: inline-grid; place-items: center; flex: none; }
.sc-ringw svg { position: absolute; inset: 0; }
.sc-ringw b { position: relative; font-size: 10px; font-weight: 700; color: var(--ink); }
.sc-bars { display: flex; align-items: flex-end; gap: 4px; }
.sc-bars i { flex: 1; min-width: 4px; border-radius: 3px 3px 0 0; background: var(--btn); opacity: .85; }
.sc-axis { display: flex; justify-content: space-between; }
.sc-axis .sc-s { font-size: 8px; }
.sc-ck { width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid oklch(0.82 0.02 285); display: grid; place-items: center; flex: none; box-sizing: border-box; }
.sc-ck.on { background: oklch(0.6 0.15 160); border-color: oklch(0.6 0.15 160); }
.sc-steps { display: flex; flex-direction: column; gap: 6px; }
.sc-steps span { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: var(--ink-3); position: relative; }
.sc-steps u { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid oklch(0.8 0.02 285); background: #fff; flex: none; box-sizing: border-box; }
.sc-steps .done { color: var(--ink-2); } .sc-steps .done u { background: oklch(0.6 0.15 160); border-color: oklch(0.6 0.15 160); }
.sc-steps .now { color: var(--ink); font-weight: 600; } .sc-steps .now u { border-color: var(--btn); box-shadow: 0 0 0 3px oklch(0.359 0.135 278 / .15); }
.sc-steps.h { flex-direction: row; gap: 10px; flex-wrap: wrap; }
.sc-box { display: inline-block; font-size: 9.5px; font-weight: 600; padding: 5px 8px; border-radius: 7px; border: 1px solid oklch(0.88 0.015 285); background: #fff; color: var(--ink-2); white-space: nowrap; }
.sc-box.on { background: var(--btn); border-color: var(--btn); color: #fff; }
.sc-arch { display: flex; align-items: center; gap: 3px; }
.sc-arch em { width: 10px; height: 1.5px; background: oklch(0.75 0.03 285); flex: none; }
.sc-arch.big { gap: 4px; }
.sc-tree { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sc-tree > span { display: flex; gap: 5px; }
.sc-code { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 9.5px; line-height: 1.6; white-space: pre; color: var(--ink-2); }
.ck-k { color: oklch(0.5 0.17 300); } .ck-f { color: oklch(0.5 0.14 250); } .ck-s { color: oklch(0.55 0.13 150); } .ck-c { color: var(--ink-3); } .ck-n { color: oklch(0.55 0.15 50); }
.sc-dots { display: inline-flex; gap: 3px; } .sc-dots i { width: 6px; height: 6px; border-radius: 50%; background: oklch(0.86 0.02 285); }
.sc-big { font-size: 20px; font-weight: 700; letter-spacing: -.02em; color: var(--ink); line-height: 1; }
.sc-big.g { color: oklch(0.5 0.14 160); }
.sc-meter { display: flex; align-items: center; gap: 8px; }
.sc-meter .sc-s { width: 52px; flex: none; }
.sc-meter u { flex: 1; height: 6px; border-radius: 3px; background: oklch(0.94 0.008 285); overflow: hidden; display: block; }
.sc-meter u i { display: block; height: 100%; border-radius: 3px; background: var(--btn); }
.sc-funnel { display: flex; flex-direction: column; gap: 3px; } .sc-funnel i { display: block; height: 6px; border-radius: 3px; background: oklch(0.7 0.12 var(--h1)); }
.sc-msg { display: flex; flex-direction: column; gap: 3px; font-size: 11px; line-height: 1.35; }
.sc-c.me { background: var(--btn); color: #fff; } .sc-c.me .sc-s { color: oklch(0.85 0.04 280); } .sc-c.me .sc-ch { background: oklch(1 0 0 / .16); color: #fff; }
.sc-pillars { display: flex; align-items: flex-end; gap: 14px; height: 54px; } .sc-pillars span { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; height: 100%; } .sc-pillars i { display: block; width: 24px; border-radius: 4px 4px 0 0; background: oklch(0.7 0.12 var(--h1)); }
.sc-coin { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; font-weight: 700; background: oklch(0.94 0.01 285); color: var(--ink-2); } .sc-coin.h { background: oklch(0.86 0.12 85); color: oklch(0.4 0.1 70); }
.sc-tip { font-size: 10px; line-height: 1.4; color: var(--ink-2); background: oklch(0.96 0.04 var(--h1)); border-radius: 7px; padding: 6px 8px; } .sc-tip b { color: var(--btn); margin-right: 4px; }
.sc-hl { display: block; padding: 2px; border-radius: 4px; background: oklch(0.95 0.06 var(--h1)); }
.sc-react { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: oklch(0.94 0.04 215); color: oklch(0.5 0.12 215); font-weight: 700; font-size: 9px; }
.sc-slide { display: grid; grid-template-columns: 1fr 1fr 1fr; row-gap: 5px; } .sc-slide u { grid-column: 1 / -1; height: 5px; border-radius: 3px; background: oklch(0.93 0.008 285); position: relative; display: block; } .sc-slide u i { position: absolute; left: 0; top: 0; bottom: 0; width: 56%; border-radius: 3px; background: var(--btn); } .sc-slide u i::after { content: ''; position: absolute; right: -5px; top: -3px; width: 11px; height: 11px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px var(--btn); } .sc-slide .sc-s:nth-child(3) { text-align: center; } .sc-slide .sc-s:nth-child(4) { text-align: right; }
.sc-cert { display: flex; flex-direction: column; gap: 2px; padding: 7px 9px; border-radius: 8px; border: 1px dashed oklch(0.8 0.05 var(--h1)); } .sc-cert b { font-size: 12px; color: var(--ink); }
.sc-nums { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; } .sc-nums i { font-style: normal; display: grid; place-items: center; height: 20px; border-radius: 6px; font-size: 10px; font-weight: 600; background: oklch(0.96 0.01 285); color: var(--ink-3); } .sc-nums i.on { background: var(--btn); color: #fff; }
.sc-grid16 { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; } .sc-grid16 i { display: block; height: 14px; border-radius: 4px; background: oklch(0.94 0.02 62); } .sc-grid16 i.on { background: oklch(0.72 0.15 55); }
.sc-name { display: flex; flex-direction: column; align-items: center; padding: 6px 8px 8px; border-radius: 8px; background: oklch(0.55 0.17 25); color: #fff; } .sc-name .sc-s { color: #fff; font-weight: 700; letter-spacing: .08em; } .sc-name b { font-size: 9px; font-weight: 500; } .sc-name em { font-style: normal; font-size: 15px; font-weight: 700; background: #fff; color: var(--ink); width: 100%; text-align: center; border-radius: 4px; margin-top: 3px; padding: 2px 0; }
.sc-pay { display: flex; flex-direction: column; gap: 2px; } .sc-pay b { font-size: 11px; color: oklch(0.45 0.14 262); }
.sc-sign { font-family: 'Bricolage Grotesque', cursive; font-style: italic; font-size: 13px; color: oklch(0.45 0.12 262); border-top: 1px solid var(--line); padding-top: 3px; }
.sc-dd { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } .sc-dd span { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: 7px; background: oklch(0.96 0.04 160); } .sc-dd span.no { background: oklch(0.96 0.03 25); } .sc-dd b { font-size: 11px; color: var(--ink); }
.sc-cal { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; } .sc-cal i { display: block; aspect-ratio: 1; border-radius: 3px; background: oklch(0.93 0.01 285); } .sc-cal i.on { background: oklch(0.62 0.13 165); } .sc-cal i.now { background: var(--btn); }
.sc-time { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 18px; font-weight: 600; letter-spacing: .02em; text-align: center; color: var(--ink); }
.sc-btn { font-style: normal; flex: 1; text-align: center; font-size: 9.5px; font-weight: 600; padding: 5px 0; border-radius: 99px; background: oklch(0.95 0.01 285); color: var(--ink-2); } .sc-btn.end { background: oklch(0.58 0.2 25); color: #fff; }
.sc-frame { display: grid; place-items: center; height: 64px; border-radius: 8px; background: oklch(0.93 0.005 285); }
.sc-rec { width: 7px; height: 7px; border-radius: 50%; background: oklch(0.58 0.22 25); margin-right: 5px; }
.sc-news { display: flex; flex-direction: column; gap: 5px; } .sc-news b { font-size: 11px; font-weight: 700; letter-spacing: -.005em; color: var(--ink); line-height: 1.25; font-family: 'Bricolage Grotesque', serif; }
.sc-cap { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: oklch(0.94 0.04 var(--h1)); color: var(--btn); margin-right: 7px; }
.sc-tiles { display: grid; grid-template-columns: repeat(3, 30px); gap: 6px; }
.sc-breath { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -46px 0 0 -30px; } .sc-breath u { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid oklch(0.85 0.006 285); } .sc-breath u:nth-child(1) { inset: 34px; background: oklch(0.86 0.006 285); border: 0; } .sc-breath u:nth-child(2) { inset: 18px; background: oklch(0.91 0.005 285 / .7); border: 0; } .sc-breath u:nth-child(3) { inset: 0; background: oklch(0.94 0.004 285 / .7); border: 0; }
.sc-pulse { width: 28px; height: 8px; background: linear-gradient(90deg, transparent 0 20%, oklch(0.6 0.15 160) 20% 25%, transparent 25% 35%, oklch(0.6 0.15 160) 35% 40%, transparent 40%); }
.sc-sun { position: absolute; right: 18px; top: 12px; width: 44px; height: 44px; border-radius: 50%; background: oklch(0.92 0.004 285); }
.sc-sky { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 62px; color: oklch(0.7 0.01 285); opacity: .55; }
.sc-pinb { width: 9px; height: 9px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--btn); margin-right: 7px; flex: none; }
.lb-card .lb-vis.sc[style*="--h1"] { transition: background-color .25s; }
@media (prefers-reduced-motion: reduce) { .sc-c { transition: none; } }
`;
