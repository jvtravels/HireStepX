import { describe, it, expect } from "vitest";
import { computeCampusReadiness } from "../_campus-readiness";

const userTurn = (text: string) => ({ speaker: "user", text });
const aiTurn = (text: string) => ({ speaker: "ai", text });

describe("computeCampusReadiness — gating", () => {
  it("returns null when transcript has no user turns", () => {
    expect(computeCampusReadiness([aiTurn("Tell me about yourself")])).toBeNull();
  });

  it("returns null when user content is under 20 chars", () => {
    expect(computeCampusReadiness([userTurn("hi")])).toBeNull();
  });

  it("returns a result once the user has produced material", () => {
    const r = computeCampusReadiness([userTurn("I am a final year BTech student from Pune University with CGPA 8.6")]);
    expect(r).not.toBeNull();
  });
});

describe("computeCampusReadiness — project chip", () => {
  it("pass when project narration + concrete stack named", () => {
    const r = computeCampusReadiness([
      userTurn("My project was a chatbot. I built it using Python and FastAPI on Postgres."),
    ]);
    expect(r?.project.state).toBe("pass");
  });

  it("warn when project narrated without naming any stack", () => {
    const r = computeCampusReadiness([
      userTurn("My project was a really cool web application that I built last semester."),
    ]);
    expect(r?.project.state).toBe("warn");
  });

  it("empty when no project is mentioned at all", () => {
    const r = computeCampusReadiness([
      userTurn("I am a final year student and I am very interested in this opportunity at your company."),
    ]);
    expect(r?.project.state).toBe("empty");
  });

  it("matches core-engineering stacks (matlab / verilog / autocad / plc)", () => {
    const r = computeCampusReadiness([
      userTurn("My project was a control system. I designed the PLC ladder logic and validated it in MATLAB Simulink."),
    ]);
    expect(r?.project.state).toBe("pass");
  });
});

describe("computeCampusReadiness — research chip", () => {
  it("pass on specific program name (NQT)", () => {
    const r = computeCampusReadiness([
      userTurn("I cleared the NQT and want to join because of the early-career project rotations I read about."),
    ]);
    expect(r?.research.state).toBe("pass");
  });

  it("warn on generic culture-talk only", () => {
    const r = computeCampusReadiness([
      userTurn("I want to join because of the great culture and great brand and learning opportunities here."),
    ]);
    expect(r?.research.state).toBe("warn");
  });

  it("empty when neither generic nor specific cues present", () => {
    const r = computeCampusReadiness([
      userTurn("I built a sentiment classifier in my last semester using Python and scikit-learn."),
    ]);
    expect(r?.research.state).toBe("empty");
  });
});

describe("computeCampusReadiness — logistics chip", () => {
  it("pass when joining / availability addressed", () => {
    const r = computeCampusReadiness([
      userTurn("My final semester exams end in May, I'm available to join from June 15 and open to relocation."),
    ]);
    expect(r?.logistics.state).toBe("pass");
  });

  it("empty when never raised", () => {
    const r = computeCampusReadiness([
      userTurn("I built a chatbot in Python last year and presented it at our college fest."),
    ]);
    expect(r?.logistics.state).toBe("empty");
  });
});

describe("computeCampusReadiness — red-flag alerts", () => {
  it("badmouth alert on 'professors were useless'", () => {
    const r = computeCampusReadiness([
      userTurn("Honestly the professors were useless and nothing was taught in the curriculum, so I self-studied everything."),
    ]);
    expect(r?.badmouth?.state).toBe("alert");
  });

  it("deficit alert when user volunteers a backlog unprompted", () => {
    const r = computeCampusReadiness([
      userTurn("I have 2 backlogs from third semester but I have cleared them in the supplementary exam."),
    ]);
    expect(r?.deficit?.state).toBe("alert");
  });

  it("implausible-team alert when fresher claims to have led 20", () => {
    const r = computeCampusReadiness([
      userTurn("I led a team of 22 in my college project to build a smart-traffic system."),
    ]);
    expect(r?.team?.state).toBe("alert");
    expect(r?.team?.label).toMatch(/22/);
  });

  it("does NOT alert on plausible team size (≤14)", () => {
    const r = computeCampusReadiness([
      userTurn("I led a team of 4 in my capstone project to build a smart-traffic system using Python."),
    ]);
    expect(r?.team).toBeNull();
  });

  it("no alerts on a clean, specific answer", () => {
    const r = computeCampusReadiness([
      userTurn("My capstone was a real-time traffic optimizer built in Python on a Raspberry Pi. I'm available from June 15."),
    ]);
    expect(r?.badmouth).toBeNull();
    expect(r?.deficit).toBeNull();
    expect(r?.team).toBeNull();
  });
});

describe("computeCampusReadiness — internship chip", () => {
  it("pass when internship + concrete detail (stipend / mentor)", () => {
    const r = computeCampusReadiness([
      userTurn("I did a summer internship at a startup where my mentor guided me and I shipped a data-pipeline feature."),
    ]);
    expect(r?.internship?.state).toBe("pass");
  });

  it("warn when internship claimed without any detail", () => {
    const r = computeCampusReadiness([
      userTurn("I have done one internship in my second year and one industrial training last summer."),
    ]);
    expect(r?.internship?.state).toBe("warn");
  });

  it("null when no internship is claimed", () => {
    const r = computeCampusReadiness([
      userTurn("I built a chatbot in Python last semester and presented it at the college fest."),
    ]);
    expect(r?.internship).toBeNull();
  });
});

describe("computeCampusReadiness — filler counter", () => {
  it("counts filler occurrences across user turns", () => {
    const long = "basically " + "i mean ".repeat(5) + "the project was good ".repeat(20);
    const r = computeCampusReadiness([userTurn(long)]);
    expect(r?.filler.count).toBeGreaterThanOrEqual(6);
  });

  it("warns past ≥4 per 100 words", () => {
    const text = ("basically i mean the project was great and i built a tool. ").repeat(15);
    const r = computeCampusReadiness([userTurn(text)]);
    expect(r?.filler.warn).toBe(true);
  });

  it("does NOT warn below threshold", () => {
    const text = "I built a real-time traffic optimizer using Python and deployed it on a Raspberry Pi for our college capstone project. ".repeat(3);
    const r = computeCampusReadiness([userTurn(text)]);
    expect(r?.filler.warn).toBe(false);
  });
});
