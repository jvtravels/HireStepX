import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");

function loadSql(): string {
  const dir = join(root, "supabase-migrations");
  const files = [join(root, "supabase-schema.sql"), ...readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => join(dir, f))];
  return files.map((f) => readFileSync(f, "utf8").replace(/--[^\n]*/g, "")).join("\n");
}

function matches(sql: string, re: RegExp): Set<string> {
  return new Set([...sql.matchAll(re)].map((m) => m[1].toLowerCase()));
}

describe("RLS coverage", () => {
  const sql = loadSql();
  const created = matches(sql, /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi);
  const secured = matches(sql, /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/gi);

  it("finds the tables", () => {
    expect(created.size).toBeGreaterThan(30);
  });

  it("enables row level security on every table", () => {
    expect([...created].filter((t) => !secured.has(t))).toEqual([]);
  });
});
