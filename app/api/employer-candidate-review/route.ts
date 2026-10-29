export const runtime = "edge";
import handler from "../../../server-handlers/employer-candidate-review";

export async function GET(req: Request) { return handler(req); }
export async function PATCH(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
