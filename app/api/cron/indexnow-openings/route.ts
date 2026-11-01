export const runtime = 'edge';
import handler from "../../../../server-handlers/cron-indexnow-openings";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
