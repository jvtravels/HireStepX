export const runtime = "edge";
import handler from "../../../server-handlers/flag-message";

export async function POST(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
