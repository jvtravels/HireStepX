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
      return <Stage h1={250}><C p={{ l: "9%", t: 14, w: "70%" }} cls="f"><T>Company library</T><span className="sc-tiles">{["Flipkart", "Razorpay", "Swiggy", "Tcs", "Google", "Amazon"].map((c) => <Mono key={c} co={c} h={hue(c, 270)} sz={30} />)}</span></C><C p={{ r: "7%", b: 18 }} cls="f2"><Ch>Rounds and tips</Ch></C></Stage>;
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
    case "/blog/optiver-interview-questions-india-2026":
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
      return <Stage h1={145}><C p={{ l: "9%", t: 12, w: "70%" }} cls="f"><Row><Mono co="Google" h={145} sz={22} /><T>Top 10 questions</T></Row><span className="sc-nums">{Array.from({ length: 10 }, (_, n) => <i key={n} className={n === 3 ? "on" : ""}>{n + 1}</i>)}</span></C><C p={{ r: "7%", b: 18 }} cls="f2"><Ch t="g">Most asked</Ch></C></Stage>;
    case "/blog/hr-interview-questions-answers-india":
      return <Stage h1={320}><C p={{ l: "9%", t: 12, w: "66%" }} cls="f"><Row><b className="sc-big">30</b><T>HR questions</T></Row>{["Why this company?", "Where in 5 years?", "Notice period?"].map((x, n) => <Row key={x} g={6}><Check on={n < 2} /><S>{x}</S></Row>)}</C></Stage>;
    case "/blog/amazon-leadership-principles-interview":
      return <Stage h1={62}><C p={{ l: "9%", t: 10, w: "62%" }} cls="f"><Row><Mono co="Amazon" h={62} sz={18} /><T>16 principles</T></Row><span className="sc-grid16">{GRID16.map((n) => <i key={n} className={n === 0 ? "on" : ""} />)}</span></C><C p={{ r: "6%", b: 12 }} cls="f2"><Ch t="o">Customer Obsession</Ch></C></Stage>;
    case "/blog/how-to-introduce-yourself-in-interview":
      return <Stage h1={195}><C p={{ l: "9%", t: 14, w: "64%" }} cls="f"><span className="sc-name"><S>HELLO</S><b>my name is</b><em>Aarav</em></span><Ln /><Ln w="72%" /></C><C p={{ r: "6%", b: 16 }} cls="f2"><Ch>Script + examples</Ch></C></Stage>;
    case "/blog/tell-me-about-yourself-best-answer":
      return <Stage h1={300}><C p={{ l: "8%", t: 12, w: "72%" }} cls="f"><Row><T>Tell me about yourself</T></Row><span className="sc-q"><mark>Present</mark>, then <mark>past</mark>, then <mark>future</mark>.</span></C><C p={{ r: "6%", b: 14 }} cls="f2"><Row><Ring pct={60} label="60s" sz={36} /></Row></C></Stage>;
    case "/blog/system-design-interview-preparation-india-2026":
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
