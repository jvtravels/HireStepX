import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILE_COLUMNS } from "../supabase";

describe("PROFILE_COLUMNS", () => {
  const schema = readFileSync(join(process.cwd(), "supabase-schema.sql"), "utf8");

  it("names only columns that exist in the schema", () => {
    const missing = PROFILE_COLUMNS.filter((c) => !new RegExp(`\\b${c}\\b`).test(schema));
    expect(missing).toEqual([]);
  });

  it("never asks for every column", () => {
    expect(PROFILE_COLUMNS).not.toContain("*" as never);
    expect(new Set(PROFILE_COLUMNS).size).toBe(PROFILE_COLUMNS.length);
  });
});
