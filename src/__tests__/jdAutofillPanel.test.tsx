import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { JdParseResponse } from "../../data/jd-extraction";
import type { RequirementDraft } from "../employer/_requirementPayload";
import { initialDraft } from "../employer/_requirementFormHelpers";

const apiFetch = vi.fn();
vi.mock("../apiClient", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../posthogClient", () => ({ captureClientEvent: vi.fn() }));

const { default: JdAutofill } = await import("../employer/JdAutofill");

const JD = "Senior Backend Engineer. We need 4-7 years of experience building payment APIs with Java and Kafka. CTC 25-35 LPA.";

const response: JdParseResponse = {
  ok: true, llm: true, cached: false, remainingToday: 9, warnings: [],
  fields: {
    title: { value: "Senior Backend Engineer", confidence: "high", evidence: "Senior Backend Engineer", source: "llm" },
    experience: { value: { min: 4, max: 7 }, confidence: "high", evidence: "4-7 years", source: "regex" },
    skills: { value: ["Java", "Kafka"], confidence: "low", evidence: "", source: "regex" },
  },
};

let latest: RequirementDraft;
let imported: Record<string, string>;

function Harness({ start }: { start?: Partial<RequirementDraft> }) {
  const [draft, setDraft] = useState<RequirementDraft>({ ...initialDraft(undefined), ...start });
  const ref = useRef<Record<string, string>>({});
  latest = draft;
  imported = ref.current;
  return <JdAutofill draft={draft} applyPatch={(p) => setDraft((d) => ({ ...d, ...p }))} importedRef={ref} />;
}

async function paste() {
  fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
  fireEvent.change(screen.getByLabelText("Job description text"), { target: { value: JD } });
  fireEvent.click(screen.getByText("Read it"));
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ ok: true, status: 200, data: response, error: null, errorData: null, headers: new Headers() });
});

describe("JdAutofill panel", () => {
  it("collapses to a one-line summary, fills blank fields and keeps a low-confidence one as a suggestion", async () => {
    render(<Harness />);
    await paste();
    await waitFor(() => expect(screen.getByText(/2 fields filled in below/)).toBeTruthy());
    expect(latest.title).toBe("Senior Backend Engineer");
    expect(latest.experienceMin).toBe("4");
    expect(latest.skills).toEqual([]);
    expect(Object.keys(imported).sort()).toEqual(["experience", "title"]);
    expect(screen.queryByText("Undo last change")).toBeNull();
    expect(screen.queryByText("Close")).toBeNull();

    fireEvent.click(screen.getByLabelText("Use suggested Skills"));
    expect(latest.skills).toEqual(["Java", "Kafka"]);
  });

  it("names the uploaded file and Replace re-fills fields the employer has not edited", async () => {
    const { container } = render(<Harness />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([JD], "jd.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(screen.getByText("jd.txt")).toBeTruthy());
    expect(screen.getByText(/2 fields filled in below/)).toBeTruthy();
    expect(latest.title).toBe("Senior Backend Engineer");

    apiFetch.mockResolvedValue({
      ok: true, status: 200, headers: new Headers(), error: null, errorData: null,
      data: { ...response, fields: { title: { value: "Staff Engineer", confidence: "high", evidence: "Staff Engineer", source: "llm" } } },
    });
    fireEvent.click(screen.getByText("Replace"));
    fireEvent.change(container.querySelector("input[type=file]") as HTMLInputElement, { target: { files: [new File([JD], "jd2.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(screen.getByText("jd2.txt")).toBeTruthy());
    expect(latest.title).toBe("Staff Engineer");
    expect(latest.experienceMin).toBe("");
  });

  it("does not overwrite what the employer already typed", async () => {
    render(<Harness start={{ title: "My title" }} />);
    await paste();
    await waitFor(() => expect(screen.getByLabelText("Use suggested Job title")).toBeTruthy());
    expect(latest.title).toBe("My title");
    expect(screen.getByText("My title").tagName).toBe("DEL");
    expect(screen.getByText("Senior Backend Engineer").tagName).toBe("INS");
  });

  it("shows the Check this badge only for low confidence and applies everything with Use all", async () => {
    render(<Harness start={{ title: "My title" }} />);
    await paste();
    await waitFor(() => expect(screen.getByText("Use all")).toBeTruthy());
    expect(screen.getAllByText("Check this")).toHaveLength(1);
    expect(screen.queryByText("Clear")).toBeNull();
    fireEvent.click(screen.getByText("Use all"));
    expect(latest.title).toBe("Senior Backend Engineer");
    expect(latest.skills).toEqual(["Java", "Kafka"]);
    expect(screen.queryByText("Needs your review")).toBeNull();
  });

  it("shows the server's message when the daily limit is reached", async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 429, data: null, error: "Used today's 10 imports.", errorData: { limitReached: true }, headers: new Headers() });
    render(<Harness />);
    await paste();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/10 imports/));
    expect(latest.title).toBe("");
  });
});
