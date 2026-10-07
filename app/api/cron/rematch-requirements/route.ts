// Node.js runtime: this cron can call runMatching (incl. an LLM rerank)
// across up to MAX_REQUIREMENTS_PER_RUN requirements. The edge 30s cap
// would silently abort mid-run on any non-trivial backlog.
export const runtime = 'nodejs';
export const maxDuration = 240;
import handler from "../../../../server-handlers/cron-rematch-requirements";

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
