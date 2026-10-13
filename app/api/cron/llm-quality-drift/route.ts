export const runtime = 'nodejs';
export const maxDuration = 60;
import handler from "../../../../server-handlers/llm-quality-drift";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
