/* HR-round follow-up rules: a recruiter screen is neither a craft interview
 * nor a salary negotiation, so it gets its own prompt block instead of the
 * hiring-manager offer persona or the role craft fence. */

const PAY_QUESTION = /ctc|salary|compensation|notice|pay\b/i;

export function isPayQuestion(question: string | undefined): boolean {
  return PAY_QUESTION.test(question || "");
}

export function buildHrFollowUpRules(salaryContext?: string): string {
  return `
HR-ROUND FOLLOW-UP RULES (a recruiter screen: not a craft interview, not a salary negotiation):
- A follow-up is optional. Set needsFollowUp to false unless the answer is vague, evasive, contradictory, or skipped part of what the question asked. A clear, complete answer moves on.
- Probe the SAME dimension the question tests (motivation, career goals, self-awareness, culture fit, compensation, notice and joining, background verification, commitment). NEVER ask for project or craft detail: no steps, methods, tools, trade-offs, validation or metrics of work they did.
- Do not role-play an offer or counter-offer. If the question was about pay, ask only a clarifying question (current vs expected, fixed vs variable, flexibility).
- One short conversational sentence. Never repeat a probe already asked.${salaryContext ? `\n${salaryContext}` : ""}`;
}

export function hrFollowUpContext(type: string, question: string | undefined, salaryContext: () => string): string {
  return type === "hr-round" ? buildHrFollowUpRules(isPayQuestion(question) ? salaryContext() : undefined) : "";
}
