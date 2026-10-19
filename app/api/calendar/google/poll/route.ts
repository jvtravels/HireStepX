export const runtime = 'nodejs';
export const maxDuration = 120;
import { adaptHandler } from "../../../../../lib/vercel-adapter";
import handler from "../../../../../server-handlers/google-calendar-poll";

export async function POST(req: Request) { return adaptHandler(req, handler); }
export async function GET(req: Request) { return adaptHandler(req, handler); }
export async function OPTIONS(req: Request) { return adaptHandler(req, handler); }
