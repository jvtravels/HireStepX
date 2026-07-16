export const runtime = 'nodejs';
export const maxDuration = 300;
import { adaptHandler } from "../../../lib/vercel-adapter";
import handler from "../../../server-handlers/send-abandonment-emails";

export async function GET(req: Request) { return adaptHandler(req, handler); }
export async function POST(req: Request) { return adaptHandler(req, handler); }
