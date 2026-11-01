import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPLOYER_SEGMENTS, isUnknownEmployerPath } from "../employerRoutes";

const root = join(__dirname, "../..");
const dirs = (p: string) =>
  readdirSync(join(root, p), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("_"))
    .map((d) => d.name);

describe("unknown employer addresses answer 404", () => {
  it("allows every real employer route folder", () => {
    for (const d of [...dirs("app/(employer)/employer"), ...dirs("app/(auth)/employer")]) {
      expect(EMPLOYER_SEGMENTS.has(d), d).toBe(true);
    }
  });
  it("flags only unknown segments", () => {
    expect(isUnknownEmployerPath("/employer/nope-404")).toBe(true);
    expect(isUnknownEmployerPath("/employer/team")).toBe(false);
    expect(isUnknownEmployerPath("/employer/requirements/abc/edit")).toBe(false);
    expect(isUnknownEmployerPath("/employer")).toBe(false);
    expect(isUnknownEmployerPath("/dashboard")).toBe(false);
  });
});
