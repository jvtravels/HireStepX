import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "./setup-next-navigation";
import { RequirementForm } from "../employer/RequirementForm";
import { DRAFT_STORAGE_KEY, initialDraft } from "../employer/_requirementFormHelpers";
import type { RequirementFormValues } from "../employer/mockData";

type Props = Parameters<typeof RequirementForm>[0];

function setup(over: Partial<Props> = {}) {
  const onSubmit = vi.fn<(v: RequirementFormValues) => Promise<boolean>>(() => Promise.resolve(true));
  const setSubmitError = vi.fn();
  render(<RequirementForm mode="create" onSubmit={onSubmit} submitError={null} setSubmitError={setSubmitError} {...over} />);
  return { onSubmit, setSubmitError };
}

const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillStepOne() {
  type(/job title/i, "Backend Engineer");
  const loc = screen.getByLabelText(/^location/i);
  fireEvent.change(loc, { target: { value: "Pune" } });
  fireEvent.keyDown(loc, { key: "Enter" });
  await screen.findByText("Pune");
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("RequirementForm (create)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts on step 1 and marks it as the current step", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Role basics" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    const current = screen.getByRole("navigation", { name: /form progress/i }).querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("Role basics");
  });

  it("does not advance with missing required fields, lists them, and focuses the first", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("2 things need fixing");
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText(/job title/i)).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(screen.getByLabelText(/job title/i));
  });

  it("walks the three steps once each step is valid", async () => {
    setup();
    await fillStepOne();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Requirements and pay" })).toBeInTheDocument();

    type(/^description/i, "Own the services behind our hiring platform end to end.");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Candidate targeting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post job" })).toBeInTheDocument();
  });

  it("only shows duration and hours for non full-time roles", () => {
    setup();
    expect(screen.queryByLabelText(/duration \(weeks\)/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    expect(screen.getByLabelText(/duration \(weeks\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hours per week/i)).toBeInTheDocument();
  });

  it("strips non digits from numeric inputs", () => {
    setup();
    type(/open positions/i, "1a2.5");
    expect(screen.getByLabelText(/open positions/i)).toHaveValue("125");
  });

  it("fills experience from a preset and toggles it off again", async () => {
    setup();
    await fillStepOne();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const preset = await screen.findByRole("button", { name: "3 to 5 yrs" });
    fireEvent.click(preset);
    expect(screen.getByLabelText(/from \(years\)/i)).toHaveValue("3");
    expect(screen.getByLabelText(/to \(years\)/i)).toHaveValue("5");
    expect(preset).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(preset);
    expect(screen.getByLabelText(/from \(years\)/i)).toHaveValue("");
    expect(preset).toHaveAttribute("aria-pressed", "false");
  });

  it("converts salary figures when the pay basis changes", async () => {
    setup();
    await fillStepOne();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { level: 1, name: "Requirements and pay" });
    type(/^minimum/i, "12");
    expect(screen.getByText(/₹12,00,000 a year|From ₹12,00,000 a year/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Per month" }));
    expect(screen.getByLabelText(/^minimum/i)).toHaveValue("100000");
  });

  it("submits a payload that omits duration and hours for full-time roles", async () => {
    const { onSubmit } = setup();
    await fillStepOne();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { level: 1, name: "Requirements and pay" });
    type(/^description/i, "Own the services behind our hiring platform end to end.");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: "Post job" });
    fireEvent.click(screen.getByRole("button", { name: "Post job" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe("Backend Engineer");
    expect(payload.locations).toEqual(["Pune"]);
    expect(payload.durationWeeks).toBeNull();
    expect(payload.hoursPerWeek).toBeNull();
  });

  it("clears the stored draft after a successful submit", async () => {
    setup();
    await fillStepOne();
    await waitFor(() => expect(localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { level: 1, name: "Requirements and pay" });
    type(/^description/i, "Own the services behind our hiring platform end to end.");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Post job" }));
    await waitFor(() => expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull());
  });

  it("offers a saved draft back and restores it", async () => {
    const draft = { ...initialDraft(), title: "Saved Role", locations: ["Delhi"] };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), draft }));
    setup();
    expect(await screen.findByText(/unfinished requirement/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
    expect(screen.getByLabelText(/job title/i)).toHaveValue("Saved Role");
    expect(screen.queryByText(/unfinished requirement/i)).toBeNull();
  });

  it("does not overwrite a pending draft before the user decides", async () => {
    const draft = { ...initialDraft(), title: "Saved Role" };
    const raw = JSON.stringify({ savedAt: 1, draft });
    localStorage.setItem(DRAFT_STORAGE_KEY, raw);
    setup();
    await screen.findByText(/unfinished requirement/i);
    type(/job title/i, "Something else");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1000));
    });
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(raw);
  });

  it("discards the saved draft on Start fresh", async () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ savedAt: 1, draft: { ...initialDraft(), title: "Old" } }));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Start fresh" }));
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(screen.getByLabelText(/job title/i)).toHaveValue("");
  });
});

describe("RequirementForm (edit)", () => {
  it("shows all three sections on one page with Save changes", () => {
    setup({ mode: "edit" });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Role basics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requirements and pay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Candidate targeting" })).toBeInTheDocument();
  });

  it("lists every problem when saving an invalid form", () => {
    const { onSubmit } = setup({ mode: "edit" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("3 things need fixing");
  });
});
