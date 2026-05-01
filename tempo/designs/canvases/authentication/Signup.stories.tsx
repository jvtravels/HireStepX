import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import Signup from "./Signup";

const meta: Meta<typeof Signup> = {
  title: "Authentication/Signup",
  component: Signup,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Signup>;

/** Empty state — what a first-time visitor sees. */
export const Default: Story = {};

/** Filled with valid name + email + strong password — CTA enabled. */
export const Filled: Story = {
  args: {
    initialName: "Rahul Sharma",
    initialEmail: "rahul@example.com",
    initialPassword: "PracticePass2026!",
  },
};

/** Weak password — strength meter shows red, message asks for variety. */
export const WeakPassword: Story = {
  args: {
    initialName: "Rahul Sharma",
    initialEmail: "rahul@example.com",
    initialPassword: "alllowercase",
  },
};

/** Loading state — spinner replaces arrow, all controls disabled. */
export const Loading: Story = {
  args: {
    initialName: "Rahul Sharma",
    initialEmail: "rahul@example.com",
    initialPassword: "PracticePass2026!",
    loading: true,
  },
};

/** Server error — banner above form. */
export const Error: Story = {
  args: {
    initialName: "Rahul Sharma",
    initialEmail: "rahul@example.com",
    initialPassword: "PracticePass2026!",
    error:
      "An account with this email already exists. Try logging in instead.",
  },
};

/** Mobile (375px) — verifies fluid type + breakpoint rules. */
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [375] },
  },
};

/* ─── Interaction tests ─────────────────────────────────────────── */

/** Submit gates on all three fields. */
export const SubmitGate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", {
      name: /create your free account/i,
    });

    await expect(submit).toBeDisabled();

    await userEvent.type(canvas.getByLabelText(/your name/i), "Rahul Sharma");
    await expect(submit).toBeDisabled();

    await userEvent.type(
      canvas.getByLabelText(/email address/i),
      "rahul@example.com",
    );
    await expect(submit).toBeDisabled();

    // Weak password (lowercase only, len ≥8) — still disabled
    await userEvent.type(canvas.getByLabelText(/^password$/i), "lowercaseonly");
    await expect(submit).toBeDisabled();

    // Strong password — enabled
    await userEvent.clear(canvas.getByLabelText(/^password$/i));
    await userEvent.type(
      canvas.getByLabelText(/^password$/i),
      "PracticePass2026!",
    );
    await expect(submit).toBeEnabled();
  },
};

/** Strength meter responds to password complexity. */
export const StrengthProgression: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const password = canvas.getByLabelText(/^password$/i);

    // Short
    await userEvent.type(password, "abc");
    await expect(canvas.getByText(/too short/i)).toBeInTheDocument();

    // Weak
    await userEvent.clear(password);
    await userEvent.type(password, "alllowercase");
    await expect(canvas.getByText(/^weak$/i)).toBeInTheDocument();

    // Strong
    await userEvent.clear(password);
    await userEvent.type(password, "PracticePass2026!");
    await expect(canvas.getByText(/^(good|strong)$/i)).toBeInTheDocument();
  },
};
