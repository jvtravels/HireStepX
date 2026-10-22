/* Conversations are 1:1 with a requirement_matches row (one per employer +
   candidate + job opening — see supabase-schema.sql's conversations table
   comment), so the same counterpart (a company, from the candidate's side;
   a candidate, from the employer's side) can have several separate threads,
   one per job. Grouping by counterpartName keeps those threads visually
   distinct instead of reading as duplicate rows differentiated only by a
   small job-title subtext. Shared by MessagesBell, MessagesV2, and
   EmployerMessagesV2 so the grouping behaves identically everywhere. */

export interface ConversationGroup<C> {
  counterpartName: string;
  conversations: C[];
}

export function groupConversationsByCounterpart<
  C extends { counterpartName: string },
>(list: C[]): ConversationGroup<C>[] {
  const order: string[] = [];
  const byName = new Map<string, C[]>();
  for (const c of list) {
    if (!byName.has(c.counterpartName)) {
      byName.set(c.counterpartName, []);
      order.push(c.counterpartName);
    }
    byName.get(c.counterpartName)!.push(c);
  }
  return order.map((counterpartName) => ({ counterpartName, conversations: byName.get(counterpartName)! }));
}
