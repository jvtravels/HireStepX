export const runtime = 'edge';
export const maxDuration = 60;
import handler from "../../../server-handlers/negotiate-turn";

export async function POST(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
