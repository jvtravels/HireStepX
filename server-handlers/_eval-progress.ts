/* Progress stage for an in-flight report grade, kept in Redis so the report
 * page can poll it while the (long-held) evaluate-session request is open or
 * while an eager grade started by save-session is still running. Best-effort:
 * every operation fails open and never blocks grading. */

import { parseEvalStage, type EvalStage } from "../src/_eval-progress";

declare const process: { env: Record<string, string | undefined> };

type RedisCmd = Array<string | number>;
export interface EvalProgressDeps {
  redis: (cmds: RedisCmd[]) => Promise<Array<{ result?: unknown }> | null>;
}

// Longer than the lock TTL so a crashed grader's stage is the only thing that lingers, and only briefly.
const STAGE_TTL_SEC = 120;

async function upstash(cmds: RedisCmd[]): Promise<Array<{ result?: unknown }> | null> {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      signal: AbortSignal.timeout(800),
    });
    return res.ok ? ((await res.json()) as Array<{ result?: unknown }>) : null;
  } catch {
    return null;
  }
}

// Scoped to the user so a guessed sessionId can't reveal another user's progress.
export const evalStageKey = (userId: string, sessionId: string) => `eval-stage:${userId}:${sessionId}`;

export async function setEvalStage(userId: string, sessionId: string, stage: EvalStage, deps: EvalProgressDeps = { redis: upstash }): Promise<void> {
  await deps.redis([["SET", evalStageKey(userId, sessionId), stage, "EX", STAGE_TTL_SEC]]);
}

export async function getEvalStage(userId: string, sessionId: string, deps: EvalProgressDeps = { redis: upstash }): Promise<EvalStage | null> {
  const out = await deps.redis([["GET", evalStageKey(userId, sessionId)]]);
  return parseEvalStage(out?.[0]?.result);
}

export async function clearEvalStage(userId: string, sessionId: string, deps: EvalProgressDeps = { redis: upstash }): Promise<void> {
  await deps.redis([["DEL", evalStageKey(userId, sessionId)]]);
}

/** A session id is a UUID in practice; reject anything that could be abused as a key. */
export function parseProgressSessionId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(raw) ? raw : null;
}
