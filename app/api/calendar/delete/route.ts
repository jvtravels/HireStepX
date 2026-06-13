export const runtime = "edge";
import handler from "../../../../server-handlers/calendar-delete";

export async function POST(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
