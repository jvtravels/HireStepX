import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import "./setup-next-navigation";
import DashboardJobs from "../DashboardJobs";

vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

describe("DashboardJobs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("fetches the uncapped ?full=1 list", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ shortlistedCount: 0, unlockedCount: 0, recent: [] }) }),
    ) as unknown as typeof fetch;
    global.fetch = fetchMock;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText(/No matches yet/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/candidate-hiring-activity?full=1", expect.anything());
  });

  it("renders a full table row with search/filter/sort chrome and opens full detail on click", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          shortlistedCount: 1,
          unlockedCount: 0,
          recent: [
            {
              id: "match-1",
              roleTitle: "Backend Engineer",
              companyName: "Acme Corp",
              companyLogoPath: null,
              companyWebsite: "https://acme.example",
              location: "Bengaluru",
              workMode: "hybrid",
              budgetMin: 12,
              budgetMax: 18,
              experienceMin: 2,
              experienceMax: 4,
              skills: ["Node.js", "Postgres"],
              noticePeriodPref: "30 days",
              openPositions: 2,
              description: "We're growing the payments platform team.",
              responsibilities: "Own the payments service.",
              niceToHave: "Kubernetes experience.",
              perksAndBenefits: ["Health insurance", "WFH stipend"],
              preferredIndustry: "Fintech",
              dueDate: "2026-09-30",
              status: "open",
              employmentType: "full-time",
              matchScore: 87,
              matchReason: "Your practice history in backend roles lines up with this role.",
              unlocked: true,
              matchedAt: new Date().toISOString().slice(0, 10),
              unlockedAt: new Date().toISOString().slice(0, 10),
            },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText("Backend Engineer")).toBeInTheDocument());

    const table = screen.getByRole("table");
    expect(within(table).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(table).getByText(/Bengaluru/)).toBeInTheDocument();
    expect(within(table).getByText("Full-time")).toBeInTheDocument();
    expect(within(table).getByText("Contacted")).toBeInTheDocument();
    expect(within(table).getByText(/Your practice history in backend roles/)).toBeInTheDocument();
    // The Figma table shows a short description snippet under the job title.
    expect(within(table).getByText("We're growing the payments platform team.")).toBeInTheDocument();

    // Filter dropdowns are populated from the real fetched match data.
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();

    fireEvent.click(within(table).getByText("Backend Engineer"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /acme\.example/ })).toHaveAttribute("href", "https://acme.example");
    expect(within(dialog).getByText("2 openings")).toBeInTheDocument();
    expect(within(dialog).getByText(/Notice: 30 days/)).toBeInTheDocument();
    expect(within(dialog).getAllByText("Fintech").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Full-time")).toBeInTheDocument();
    expect(within(dialog).getByText("We're growing the payments platform team.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Own the payments service\./)).toBeInTheDocument();
    expect(within(dialog).getByText(/Kubernetes experience\./)).toBeInTheDocument();
    expect(within(dialog).getByText("Health insurance")).toBeInTheDocument();
    expect(within(dialog).getByText(/Hiring by 2026-09-30/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("filters rows client-side by search text", async () => {
    const baseRow = {
      companyLogoPath: null,
      companyWebsite: null,
      workMode: null,
      budgetMin: null,
      budgetMax: null,
      experienceMin: null,
      experienceMax: null,
      skills: [],
      noticePeriodPref: null,
      openPositions: null,
      description: null,
      responsibilities: null,
      niceToHave: null,
      perksAndBenefits: [],
      preferredIndustry: null,
      dueDate: null,
      status: "open",
      employmentType: null,
      matchScore: 60,
      matchReason: "Matched on your overall profile and practice history.",
      unlocked: true,
      unlockedAt: "2026-09-21",
    };
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          shortlistedCount: 2,
          unlockedCount: 0,
          recent: [
            { ...baseRow, id: "match-1", roleTitle: "Backend Engineer", companyName: "Acme Corp", location: "Bengaluru", matchedAt: "2026-09-20" },
            { ...baseRow, id: "match-2", roleTitle: "Frontend Engineer", companyName: "Globex", location: "Pune", matchedAt: "2026-09-21" },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText("Backend Engineer")).toBeInTheDocument());
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search by job title/), { target: { value: "Globex" } });

    await waitFor(() => expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument());
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("shows a ROLE CLOSED badge in the row and placeholders in the detail view", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          shortlistedCount: 1,
          unlockedCount: 0,
          recent: [
            {
              id: "match-1",
              roleTitle: "SDE II",
              companyName: "Beta Inc",
              companyLogoPath: null,
              companyWebsite: null,
              location: "",
              workMode: null,
              budgetMin: null,
              budgetMax: null,
              experienceMin: null,
              experienceMax: null,
              skills: [],
              noticePeriodPref: null,
              openPositions: null,
              description: null,
              responsibilities: null,
              niceToHave: null,
              perksAndBenefits: [],
              preferredIndustry: null,
              dueDate: null,
              status: "closed",
              employmentType: null,
              matchScore: 55,
              matchReason: "Matched on your overall profile and practice history.",
              unlocked: false,
              matchedAt: new Date().toISOString().slice(0, 10),
              unlockedAt: null,
            },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText("Role closed")).toBeInTheDocument());
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();

    fireEvent.click(screen.getByText("SDE II"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Location not specified/)).toBeInTheDocument();
    expect(within(dialog).getByText("Compensation not disclosed")).toBeInTheDocument();
    expect(within(dialog).getByText("No specific skills listed for this role.")).toBeInTheDocument();
    expect(within(dialog).getByText("This employer hasn't added a role description yet.")).toBeInTheDocument();
    expect(within(dialog).getByText("No perks or benefits listed.")).toBeInTheDocument();
  });

  it("shows a distinct error state (not the empty state) on a fetch rejection", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText(/Couldn't load your matches/)).toBeInTheDocument());
    expect(screen.queryByText(/No matches yet/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
