export const runtime = "edge";
import handler from "../../../../../server-handlers/google-calendar-webhook";

export async function POST(req: Request) { return handler(req); }
