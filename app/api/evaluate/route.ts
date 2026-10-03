export const runtime = 'edge';
// Matches the 38-40s totalBudgetMs in server-handlers/evaluate.ts (2026-10-04)
// so the platform's own execution ceiling can't kill a Gemini-fallback call
// before it finishes — see that file for the full timeout history.
export const maxDuration = 55;
import handler from "../../../server-handlers/evaluate";

export async function POST(req: Request) { return handler(req); }
export async function GET(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
