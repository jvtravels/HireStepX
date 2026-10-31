import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILE_COLUMNS, missingProfileColumn } from "../supabase";

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

describe("missingProfileColumn", () => {
  it("reads the column name from the PostgREST message", () => {
    expect(missingProfileColumn("column profiles.avatar_url does not exist")).toBe("avatar_url");
    expect(missingProfileColumn("column avatar_url does not exist")).toBe("avatar_url");
  });
  it("returns null for other errors", () => {
    expect(missingProfileColumn("permission denied")).toBeNull();
    expect(missingProfileColumn(undefined)).toBeNull();
  });
});
