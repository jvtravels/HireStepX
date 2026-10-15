export const runtime = "edge";
import handler from "../../../server-handlers/employer-candidate-requests";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
