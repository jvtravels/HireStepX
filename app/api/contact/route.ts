export const runtime = 'edge';
import handler from "../../../server-handlers/contact";

export async function POST(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
