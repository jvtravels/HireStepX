import { describe, it, expect, vi } from "vitest";
import { buildIndexNowPayload, pingIndexNow, INDEXNOW_KEY } from "../../server-handlers/_indexnow";
import { readFileSync } from "node:fs";

vi.stubEnv("CRON_SECRET", "s3cret");
const { default: handler } = await import("../../server-handlers/cron-indexnow-openings");

describe("indexnow", () => {
  it("builds absolute, de-duplicated URLs and a key location", () => {
    const p = buildIndexNowPayload(["/openings", "/openings", "/openings/a-1"]);
    expect(p.urlList).toEqual(["https://hirestepx.com/openings", "https://hirestepx.com/openings/a-1"]);
    expect(p.keyLocation).toBe(`https://hirestepx.com/${INDEXNOW_KEY}.txt`);
  });
  it("serves the key file the payload points at", () => {
    expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, "utf8")).toBe(INDEXNOW_KEY);
  });
  it("treats 200 and 202 as accepted, others as failed, and skips empty lists", async () => {
    expect((await pingIndexNow(["/x"], vi.fn(async () => new Response("", { status: 202 })) as unknown as typeof fetch)).ok).toBe(true);
    expect((await pingIndexNow(["/x"], vi.fn(async () => new Response("", { status: 403 })) as unknown as typeof fetch)).ok).toBe(false);
    const never = vi.fn();
    expect((await pingIndexNow([], never as unknown as typeof fetch)).count).toBe(0);
    expect(never).not.toHaveBeenCalled();
  });
  it("cron refuses requests without the bearer secret", async () => {
    expect((await handler(new Request("https://x/api/cron/indexnow-openings"))).status).toBe(401);
    expect((await handler(new Request("https://x/api/cron/indexnow-openings", { headers: { "x-vercel-cron": "1" } }))).status).toBe(401);
  });
});
