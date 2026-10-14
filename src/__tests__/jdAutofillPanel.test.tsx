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
const { flashJdFields } = await import("../employer/_jdAutofillHelpers");

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
  fireEvent.click(screen.getByRole("button", { name: "Paste" }));
  fireEvent.change(screen.getByLabelText("Job description text"), { target: { value: JD } });
  fireEvent.click(screen.getByText("Read it"));
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ ok: true, status: 200, data: response, error: null, errorData: null, headers: new Headers() });
});

describe("JdAutofill panel", () => {
  it("starts as one collapsed row with Upload and Paste, and the header toggles the import options", async () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: /Start from a job description/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByLabelText("Job description text")).toBeNull();
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Upload" })).toBeNull();

    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("tablist")).toBeNull());
  });

  it("opens the review list when something needs review and lets the employer collapse it", async () => {
    render(<Harness />);
    await paste();
    await waitFor(() => expect(screen.getByText("1 to review")).toBeTruthy());
    expect(screen.getByLabelText("Use suggested Skills")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /1 to review/ }));
    await waitFor(() => expect(screen.queryByLabelText("Use suggested Skills")).toBeNull());
    expect(screen.getByText("1 to review")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /1 to review/ }));
    fireEvent.click(screen.getByLabelText("Use suggested Skills"));
    expect(screen.queryByText("1 to review")).toBeNull();
    expect(screen.queryByRole("button", { name: /fields filled in below/ })).toBeNull();
  });

  it("imports a file dropped anywhere on the page, but ignores text drags", async () => {
    render(<Harness />);
    const file = new File([JD], "dropped.txt", { type: "text/plain" });
    fireEvent.dragEnter(window, { dataTransfer: { types: ["text/plain"], files: [] } });
    expect(screen.getByText("Start from a job description")).toBeTruthy();

    fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(screen.getByText("Drop to import")).toBeTruthy();
    fireEvent.drop(window, { dataTransfer: { types: ["Files"], files: [file] } });
    await waitFor(() => expect(screen.getByText("dropped.txt")).toBeTruthy());
    expect(latest.title).toBe("Senior Backend Engineer");
  });

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

  it("shows the Check this badge only for low confidence and Use all skips the unsure ones", async () => {
    render(<Harness start={{ title: "My title", experienceMin: "2", experienceMax: "3" }} />);
    await paste();
    await waitFor(() => expect(screen.getByText("Use 2 confident")).toBeTruthy());
    expect(screen.getAllByText("Check this")).toHaveLength(1);
    expect(screen.queryByText("Clear")).toBeNull();
    fireEvent.click(screen.getByText("Use 2 confident"));
    expect(latest.title).toBe("Senior Backend Engineer");
    expect(latest.experienceMin).toBe("4");
    expect(latest.skills).toEqual([]);
    expect(screen.getByLabelText("Use suggested Skills")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Use suggested Skills"));
  });

  it("offers a plain Use all when every suggestion is confident", async () => {
    apiFetch.mockResolvedValue({
      ok: true, status: 200, headers: new Headers(), error: null, errorData: null,
      data: { ...response, fields: { ...response.fields, skills: { value: ["Java"], confidence: "high", evidence: "Java", source: "llm" } } },
    });
    render(<Harness start={{ title: "My title", experienceMin: "2", experienceMax: "3", skills: ["Go"] }} />);
    await paste();
    await waitFor(() => expect(screen.getByText("Use all")).toBeTruthy());
  });

  it("moves focus to the next suggestion, then to the status line, instead of dropping it to the page", async () => {
    render(<Harness start={{ title: "My title" }} />);
    await paste();
    await waitFor(() => expect(screen.getByLabelText("Use suggested Job title")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Use suggested Job title"));
    expect(document.activeElement).toBe(screen.getByLabelText("Use suggested Skills"));
    fireEvent.click(screen.getByLabelText("Use suggested Skills"));
    await waitFor(() => expect(document.activeElement?.getAttribute("role")).toBe("status"));
  });

  it("supports arrow keys across the import tabs and keeps only the active tab in the tab order", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Start from a job description/ }));
    const upload = screen.getByRole("tab", { name: "Upload" });
    const paste = screen.getByRole("tab", { name: "Paste" });
    expect(upload.getAttribute("tabindex")).toBe("0");
    expect(paste.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(upload.id);

    upload.focus();
    fireEvent.keyDown(upload, { key: "ArrowRight" });
    expect(paste.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(paste);
    expect(screen.getByLabelText("Job description text")).toBeTruthy();
    fireEvent.keyDown(paste, { key: "Home" });
    expect(upload.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(upload);
  });

  it("lets the employer cancel a read in progress and returns focus to the header", async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    render(<Harness />);
    await paste();
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.getByRole("button", { name: /Start from a job description/ })).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Start from a job description/ })));
    expect(latest.title).toBe("");
  });

  it("shows the server's message when the daily limit is reached", async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 429, data: null, error: "Used today's 10 imports.", errorData: { limitReached: true }, headers: new Headers() });
    render(<Harness />);
    await paste();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/10 imports/));
    expect(latest.title).toBe("");
  });

  it("flashes the form controls that were filled, including a tag field's container", async () => {
    document.body.innerHTML = '<input id="rf-title" /><div class="rf-chipfield"><input id="rf-skills" /></div><input id="rf-open" />';
    flashJdFields(["title", "skills"]);
    await waitFor(() => expect(document.getElementById("rf-title")?.classList.contains("jd-flash")).toBe(true));
    expect(document.getElementById("rf-skills")?.parentElement?.classList.contains("jd-flash")).toBe(true);
    expect(document.getElementById("rf-open")?.classList.contains("jd-flash")).toBe(false);
    document.body.innerHTML = "";
  });
});
