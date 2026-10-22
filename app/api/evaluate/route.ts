// Node, not edge: the Edge runtime must send response headers within 25s, but
// this handler's LLM chain budgets 38-40s (server-handlers/evaluate.ts), so
// slow Gemini fallbacks were killed with a 504 "did not return an initial
// response" (2026-10-21 logs). Node honours maxDuration for the full body.
export const runtime = 'nodejs';
export const maxDuration = 55;
import handler from "../../../server-handlers/evaluate";

export async function POST(req: Request) { return handler(req); }
export async function GET(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
