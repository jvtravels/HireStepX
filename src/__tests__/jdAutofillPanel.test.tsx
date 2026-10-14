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
  fireEvent.click(screen.getByText("Paste text instead"));
  fireEvent.change(screen.getByLabelText("Job description text"), { target: { value: JD } });
  fireEvent.click(screen.getByText("Read it"));
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ ok: true, status: 200, data: response, error: null, errorData: null, headers: new Headers() });
});

describe("JdAutofill panel", () => {
  it("fills blank fields, lists a low-confidence one as a suggestion, and undoes the import", async () => {
    render(<Harness />);
    await paste();
    await waitFor(() => expect(screen.getByText(/1 for you to check|2 filled in/)).toBeTruthy());
    expect(latest.title).toBe("Senior Backend Engineer");
    expect(latest.experienceMin).toBe("4");
    expect(latest.skills).toEqual([]);
    expect(Object.keys(imported).sort()).toEqual(["experience", "title"]);

    fireEvent.click(screen.getByLabelText("Use suggested Skills"));
    expect(latest.skills).toEqual(["Java", "Kafka"]);

    fireEvent.click(screen.getByText("Undo last change"));
    expect(latest.skills).toEqual([]);
    fireEvent.click(screen.getByText("Undo last change"));
    expect(latest.title).toBe("");
    expect(latest.experienceMin).toBe("");
  });

  it("does not overwrite what the employer already typed", async () => {
    render(<Harness start={{ title: "My title" }} />);
    await paste();
    await waitFor(() => expect(screen.getByLabelText("Use suggested Job title")).toBeTruthy());
    expect(latest.title).toBe("My title");
  });

  it("shows the server's message when the daily limit is reached", async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 429, data: null, error: "Used today's 10 imports.", errorData: { limitReached: true }, headers: new Headers() });
    render(<Harness />);
    await paste();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/10 imports/));
    expect(latest.title).toBe("");
  });
});
