import { realpathSync } from "node:fs";

export const dynamic = "force-dynamic";

export function GET() {
  let projectRoot: string;
  try {
    projectRoot = realpathSync.native(process.cwd());
  } catch {
    projectRoot = process.cwd();
  }
  return Response.json({ tempoHost: true, projectRoot });
}
