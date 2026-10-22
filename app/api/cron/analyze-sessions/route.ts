// Node.js runtime required: this cron loops over up to 200 sessions calling
// the LLM per session. The edge 30s cap would silently abort mid-run on any
// non-trivial batch. Node.js serverless supports up to 300s on Vercel Pro.
export const runtime = 'nodejs';
export const maxDuration = 240;
import handler from "../../../../server-handlers/analyze-sessions-cron";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
