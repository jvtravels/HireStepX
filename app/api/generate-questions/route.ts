export const runtime = 'nodejs';
export const maxDuration = 60;
import handler from "../../../server-handlers/generate-questions";

export async function POST(req: Request) { return handler(req); }
export async function GET(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
