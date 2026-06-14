export const runtime = "nodejs";
import adminLoginHandler, { adminLogoutHandler } from "../../../server-handlers/admin-login";

export async function POST(req: Request) { return adminLoginHandler(req); }
export async function DELETE(req: Request) { return adminLogoutHandler(req); }
export async function OPTIONS(req: Request) { return adminLoginHandler(req); }
