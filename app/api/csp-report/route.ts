export const runtime = 'edge';
import handler from "../../../server-handlers/csp-report";

export async function POST(req: Request) { return handler(req); }
