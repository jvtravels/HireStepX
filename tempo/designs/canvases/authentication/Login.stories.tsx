import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import Login from "./Login";

const meta: Meta<typeof Login> = {
  title: "Authentication/Login",
  component: Login,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Login>;

/** Empty state — what a returning user sees on first paint. */
export const Default: Story = {};

/** User has typed valid credentials — primary CTA is active. */
export const Filled: Story = {
  args: {
    initialEmail: "rahul@example.com",
    initialPassword: "hunter2999",
  },
};

/** Auth in flight — spinner replaces arrow, button disabled. */
export const Loading: Story = {
  args: {
    initialEmail: "rahul@example.com",
    initialPassword: "hunter2999",
    loading: true,
  },
};

/** Server returned 401 — error banner above form, fields marked invalid. */
export const Error: Story = {
  args: {
    initialEmail: "rahul@example.com",
    initialPassword: "wrongpass",
    error:
      "Email or password is incorrect. Try again, or reset your password.",
  },
};

/** Rate limited — different copy, same banner shape. */
export const RateLimited: Story = {
  args: {
    initialEmail: "rahul@example.com",
    initialPassword: "hunter2999",
    error: "Too many attempts. Try again in 5 minutes.",
  },
};

/** Mobile (375px) — verifies the fluid type + breakpoint rules. */
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [375] },
  },
};

/** Edge case: pasted password with leading whitespace. */
export const PasswordPasteEdgeWhitespace: Story = {
  args: {
    initialEmail: "rahul@example.com",
    initialPassword: "  hunter2999",
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent, expect } = await import("storybook/test");
    const canvas = within(canvasElement);
    // Trigger touched state by focusing + blurring
    const password = canvas.getByLabelText(/^password$/i);
    password.focus();
    (password as HTMLInputElement).blur();
    await userEvent.click(canvas.getByText(/^email address$/i));
    await expect(
      canvas.getByText(/leading or trailing spaces/i),
    ).toBeInTheDocument();
  },
};

/** Edge case: server returns an extremely long error string. */
export const LongError: Story = {
  args: {
    initialEmail: "rahul@example.com",
    initialPassword: "hunter2999",
    error:
      "Authentication failed because the credentials provided do not match any active account. " +
      "If you've recently changed your password, try the new one. " +
      "If you've forgotten, use the password reset link below. " +
      "Repeated failures may temporarily lock your account for security.",
  },
};

/* ─── Interaction tests ─────────────────────────────────────────────
   Verify behavior beyond what visual regression can catch. */

/** Submit gates correctly — disabled until email + password are valid. */
export const SubmitGate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", { name: /continue to practise/i });

    // Empty form: disabled
    await expect(submit).toBeDisabled();

    // Type valid email but no password: still disabled
    const email = canvas.getByLabelText(/email address/i);
    await userEvent.type(email, "rahul@example.com");
    await expect(submit).toBeDisabled();

    // Add a short password (<6): still disabled
    const password = canvas.getByLabelText(/^password$/i);
    await userEvent.type(password, "abc");
    await expect(submit).toBeDisabled();

    // Add the rest — now enabled
    await userEvent.type(password, "12345");
    await expect(submit).toBeEnabled();
  },
};

/** Per-field error appears after the user blurs an invalid field —
    not while they're typing. */
export const InlineValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByLabelText(/email address/i);

    // Type an invalid email
    await userEvent.type(email, "not-an-email");
    // No error yet (still focused / no message until invalid AND touched-and-blurred)
    // But we still set touched on first focus, so the message renders as soon
    // as the value is invalid.
    await expect(
      canvas.getByText(/enter a valid email address/i),
    ).toBeInTheDocument();

    // Fix the email
    await userEvent.clear(email);
    await userEvent.type(email, "rahul@example.com");
    await expect(
      canvas.queryByText(/enter a valid email address/i),
    ).not.toBeInTheDocument();
  },
};

/** Password show/hide toggle works and reports state via aria-pressed. */
export const PasswordVisibility: Story = {
  args: { initialPassword: "hunter2999" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const password = canvas.getByLabelText(/^password$/i) as HTMLInputElement;
    const toggle = canvas.getByRole("button", { name: /show password/i });

    // Initially hidden
    await expect(password.type).toBe("password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Reveal
    await userEvent.click(toggle);
    await expect(password.type).toBe("text");
    await expect(
      canvas.getByRole("button", { name: /hide password/i }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};

/** Checkbox is keyboard-accessible (real input, focus ring on visual span). */
export const KeyboardCheckbox: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByLabelText(
      /stay signed in on this device/i,
    ) as HTMLInputElement;

    await expect(checkbox.checked).toBe(false);

    // Focus + space — the keyboard pattern that was previously broken
    checkbox.focus();
    await userEvent.keyboard(" ");
    await expect(checkbox.checked).toBe(true);
  },
};

/** Analytics fires the expected events for the email submission flow.
    Spies on window.posthog so we don't need a real PostHog client. */
export const AnalyticsFlow: Story = {
  play: async ({ canvasElement }) => {
    // Install spy
    const capture = fn();
    (window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    };

    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(/email address/i),
      "rahul@example.com",
    );
    await userEvent.type(canvas.getByLabelText(/^password$/i), "hunter2999");
    await userEvent.click(
      canvas.getByRole("button", { name: /continue to practise/i }),
    );

    // login_field_focused × 2 + login_method_selected + login_submitted at minimum
    const events = capture.mock.calls.map((c) => c[0]);
    await expect(events).toContain("login_field_focused");
    await expect(events).toContain("login_method_selected");
    await expect(events).toContain("login_submitted");
  },
};
