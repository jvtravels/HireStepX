import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ResendVerification, {
  RESEND_COOLDOWN_SECONDS,
  RESEND_SUCCESS_MESSAGE,
  resendButtonLabel,
} from "../auth/ResendVerification";

describe("resendButtonLabel", () => {
  it("covers idle, sending and cooldown", () => {
    expect(resendButtonLabel(false, 0)).toBe("Resend verification email");
    expect(resendButtonLabel(true, 0)).toBe("Sending...");
    expect(resendButtonLabel(false, 12)).toBe("Resend in 12s");
  });
});

describe("<ResendVerification />", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks for an email first and does not call the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResendVerification email="" />);
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Enter your email address first.");
  });

  it("posts the email, shows the generic message and starts a cooldown", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResendVerification email="  A@Example.com " />);
    await act(async () => { fireEvent.click(screen.getByRole("button")); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/resend-verification");
    expect(JSON.parse(String(init.body)).email).toBe("A@example.com");
    expect(screen.getByRole("status").textContent).toBe(RESEND_SUCCESS_MESSAGE);

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe(`Resend in ${RESEND_COOLDOWN_SECONDS}s`);

    await act(async () => { vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000); });
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("surfaces a 429 as an error and still cools down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    render(<ResendVerification email="a@example.com" />);
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    expect(screen.getByRole("status").textContent).toMatch(/too many requests/i);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
