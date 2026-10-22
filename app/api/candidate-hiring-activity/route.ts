export const runtime = 'edge';
import handler from "../../../server-handlers/candidate-hiring-activity";
export async function GET(req: Request) { return handler(req); }
export async function OPTIONS(req: Request) { return handler(req); }
