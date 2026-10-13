/* PII-scrubbing front door for callLLM.

   Every handler that sends user-provided text to a third-party model must
   import callLLM from here, not from "./_llm" — src/__tests__/piiLlmWiring.test.ts
   fails the build if a file reaches around this wrapper. Identifiers are
   swapped for placeholders on the way out and restored in the reply. */

import { callLLM as rawCallLLM } from "./_llm";
import { scrubPii, restorePii } from "./_pii-scrub";

export { extractJSON } from "./_llm";

type CallArgs = Parameters<typeof rawCallLLM>;
type CallResult = Awaited<ReturnType<typeof rawCallLLM>>;

export async function callLLM(opts: CallArgs[0], ...rest: [CallArgs[1]?, CallArgs[2]?]): Promise<CallResult> {
  const { text, map } = scrubPii(opts.prompt);
  if (Object.keys(map).length === 0) return rawCallLLM(opts, ...rest);
  const result = await rawCallLLM({ ...opts, prompt: text }, ...rest);
  return { ...result, text: restorePii(result.text, map, { json: !!opts.jsonMode }) };
}
