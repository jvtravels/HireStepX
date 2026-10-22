export const runtime = 'nodejs';
export const maxDuration = 60;
import { adaptHandler } from "../../../lib/vercel-adapter";
import handler from "../../../server-handlers/prune-llm-usage";

export async function GET(req: Request) { return adaptHandler(req, handler); }
export async function POST(req: Request) { return adaptHandler(req, handler); }
