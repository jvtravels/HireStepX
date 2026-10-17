export const runtime = 'nodejs';
export const maxDuration = 120;
import handler from "../../../server-handlers/cron-credit-no-response";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
