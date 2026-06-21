// Node serverless (not edge): the LLM-evaluation path can legitimately run
// ~50s when the Groq primary is rate-limited and a verbose fallback
// (gemini-2.5-flash) generates the full HR report. Edge functions cap at
// ~25s regardless of config and were returning FUNCTION_INVOCATION_TIMEOUT
// (504) right after the fallback completed. App Router only honours route
// segment exports — the handler's `config.maxDuration` was dead code — so the
// duration MUST be declared here. The handler uses no edge-only APIs.
export const runtime = 'nodejs';
// 100s headroom: worst case is a slow primary fallback (gemini-2.5-flash, up
// to 50s) + strict retry (up to 40s) + overhead when the Groq primary is
// rate-limited. The happy path (Groq ~5s) returns immediately.
export const maxDuration = 100;
import handler from "../../../server-handlers/evaluate-session";

export async function POST(req: Request) { return handler(req); }
export async function GET(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
