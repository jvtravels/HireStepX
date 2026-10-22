export const runtime = 'edge';
import handler from "../../../server-handlers/ping";

export async function GET() { return handler(); }
export async function HEAD() { return handler(); }
