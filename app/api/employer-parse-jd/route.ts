export const runtime = 'nodejs';
export const maxDuration = 60;
import handler from "../../../server-handlers/employer-parse-jd";

export async function POST(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
