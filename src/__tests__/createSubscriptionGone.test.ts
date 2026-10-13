import { describe, it, expect, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../../server-handlers/create-subscription";

describe("create-subscription (retired)", () => {
  it("answers 410 Gone and never starts a recurring charge", async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await handler({} as VercelRequest, { status } as unknown as VercelResponse);
    expect(status).toHaveBeenCalledWith(410);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("no longer offered") }));
  });
});
