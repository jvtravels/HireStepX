// Node.js runtime: fans out to the Razorpay REST API for each stale order.
export const runtime = 'nodejs';
export const maxDuration = 120;
import handler from "../../../server-handlers/cron-reconcile-unlock-orders";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
