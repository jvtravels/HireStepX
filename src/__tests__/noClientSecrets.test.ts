import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PUBLIC_OK = /^(NEXT_PUBLIC_[A-Z0-9_]+|NODE_ENV|NEXT_RUNTIME|CI|TEMPO|PLAYWRIGHT\w*|VERCEL_ENV|VERCEL_GIT_COMMIT_SHA)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("browser bundle never references server secrets", () => {
  it("src/ only reads public env vars", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (!PUBLIC_OK.test(m[1])) offenders.push(`${file.replace(ROOT, "")}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no API route hands a raw vendor key to the caller", () => {
    const offenders: string[] = [];
    const dir = join(ROOT, "server-handlers");
    for (const name of readdirSync(dir).filter((n) => /\.ts$/.test(n))) {
      const text = readFileSync(join(dir, name), "utf8");
      if (/apiKey:\s*(SARVAM|DEEPGRAM|CARTESIA|GROQ|GEMINI|AZURE_TTS|RESEND|RAZORPAY)\w*/.test(text)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});
