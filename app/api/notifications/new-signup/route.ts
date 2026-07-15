export const runtime = "edge";
import handler from "../../../../server-handlers/new-signup-notification";

export async function POST(req: Request) { return handler(req); }
