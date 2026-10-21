import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Handlers query PostgREST with hand-written select= strings. A column that
// isn't in the schema yet (code deployed before its migration) makes the whole
// request 400, which the handlers surface as a 500. This checks every static
// select against supabase-schema.sql so that drift fails CI instead of prod.

const ROOT = join(__dirname, "..", "..");
const schema = readFileSync(join(ROOT, "supabase-schema.sql"), "utf8").replace(/--[^\n]*/g, "");

function parseSchema(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(/gi;
  for (let m = createRe.exec(sql); m; m = createRe.exec(sql)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < sql.length && depth > 0; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") depth--;
    }
    const body = sql.slice(start, i - 1);
    const cols = tables.get(m[1]) ?? new Set<string>();
    let d = 0;
    let cur = "";
    const parts: string[] = [];
    for (const ch of body) {
      if (ch === "(") d++;
      else if (ch === ")") d--;
      if (ch === "," && d === 0) {
        parts.push(cur);
        cur = "";
      } else cur += ch;
    }
    parts.push(cur);
    for (const p of parts) {
      const first = p.trim().match(/^"?(\w+)"?\s+\S/);
      if (first && !/^(primary|unique|constraint|foreign|check|exclude|like)$/i.test(first[1])) cols.add(first[1]);
    }
    tables.set(m[1], cols);
  }
  const alterRe = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+([^;]+);/gi;
  for (let m = alterRe.exec(sql); m; m = alterRe.exec(sql)) {
    const cols = tables.get(m[1]) ?? new Set<string>();
    const addRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi;
    for (let a = addRe.exec(m[2]); a; a = addRe.exec(m[2])) cols.add(a[1]);
    tables.set(m[1], cols);
  }
  return tables;
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let d = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    if (ch === "," && d === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function checkSelect(table: string, select: string, tables: Map<string, Set<string>>, where: string, problems: string[]) {
  const cols = tables.get(table);
  if (!cols) return;
  for (const item of splitTop(select)) {
    const embed = item.match(/^(?:\w+:)?(\w+)(?:![\w]+)?\(([\s\S]*)\)$/);
    if (embed) {
      const target = tables.get(embed[1]) ? embed[1] : null;
      if (target) checkSelect(target, embed[2], tables, where, problems);
      continue;
    }
    const name = item.replace(/^\w+:/, "").replace(/::.*$/, "").trim();
    if (name === "*" || !/^\w+$/.test(name)) continue;
    if (!cols.has(name)) problems.push(`${where}: ${table}.${name} is not in supabase-schema.sql`);
  }
}

function collectSelects(src: string): Array<{ table: string; select: string }> {
  const flat = src.replace(/[`'"]\s*\+\s*[`'"]/g, "");
  const found: Array<{ table: string; select: string }> = [];
  const re = /rest\/v1\/(\w+)\?([^`'"]*(?:\$\{[^}]*\}[^`'"]*)*)/g;
  for (let m = re.exec(flat); m; m = re.exec(flat)) {
    const sel = m[2].match(/(?:^|&)select=([^&]*)/);
    if (!sel || sel[1].includes("${")) continue;
    found.push({ table: m[1], select: sel[1] });
  }
  return found;
}

// Known-broken selects: these columns are absent from the live database too
// (verified), so each request 400s in production. Remove an entry once its
// migration or code fix lands; do not add new ones.
const KNOWN_DRIFT = new Set([
  "google-calendar-poll.ts: google_calendar_sync.watch_expiry",
  "google-calendar-poll.ts: google_calendar_sync.watch_channel_id",
  "google-calendar-poll.ts: google_calendar_sync.watch_resource_id",
  "pause-subscription.ts: profiles.paused_days_remaining",
  "send-winback-emails.ts: profiles.session_credits",
]);

describe("PostgREST select strings match supabase-schema.sql", () => {
  const tables = parseSchema(schema);

  it("parses the schema", () => {
    expect(tables.get("requirement_matches")?.has("profile_viewed_at")).toBe(true);
    expect(tables.size).toBeGreaterThan(20);
  });

  it("every static select references existing columns", () => {
    const dir = join(ROOT, "server-handlers");
    const problems: string[] = [];
    let checked = 0;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      for (const { table, select } of collectSelects(readFileSync(join(dir, f), "utf8"))) {
        checked++;
        checkSelect(table, select, tables, f, problems);
      }
    }
    expect(checked).toBeGreaterThan(50);
    const fresh = problems.filter((p) => !KNOWN_DRIFT.has(p.replace(" is not in supabase-schema.sql", "")));
    expect(fresh).toEqual([]);
  });
});
