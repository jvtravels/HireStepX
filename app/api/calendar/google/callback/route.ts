export const runtime = "edge";
import handler from "../../../../../server-handlers/google-calendar-callback";

export async function GET(req: Request) { return handler(req); }
