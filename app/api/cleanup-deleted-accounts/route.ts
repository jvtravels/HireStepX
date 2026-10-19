export const runtime = 'nodejs';
export const maxDuration = 120;
import { adaptHandler } from "../../../lib/vercel-adapter";
import handler from "../../../server-handlers/cleanup-deleted-accounts";

export async function GET(req: Request) { return adaptHandler(req, handler); }
export async function POST(req: Request) { return adaptHandler(req, handler); }
