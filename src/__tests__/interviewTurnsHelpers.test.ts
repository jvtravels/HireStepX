import { describe, it, expect } from "vitest";
import { validateTurns, partitionBySession, MAX_TURNS_PER_REQUEST, MAX_TURN_CONTENT } from "../../server-handlers/_interview-turns-helpers";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const turn = (over: Record<string, unknown> = {}) => ({
  id: id(1), session_id: "s1", user_id: "attacker", turn_index: 0,
  turn_type: "answer", speaker: "user", content: "hi", metadata: { a: 1 }, ...over,
});

describe("validateTurns", () => {
  it("forces user_id from auth, never the body", () => {
    const { valid } = validateTurns([turn()], "real-user");
    expect(valid[0].user_id).toBe("real-user");
  });
  it("returns nothing for non-arrays", () => {
    expect(validateTurns("x", "u")).toEqual({ valid: [], invalid: [] });
  });
  it("drops malformed turns with their id so the client can discard them", () => {
    const { valid, invalid } = validateTurns([
      turn({ id: id(2), turn_type: "bogus" }),
      turn({ id: id(3), speaker: "robot" }),
      turn({ id: id(4), turn_index: -1 }),
      turn({ id: id(5), turn_index: 1.5 }),
      turn({ id: id(6), session_id: "" }),
      turn({ id: "not-a-uuid" }),
      null,
    ], "u");
    expect(valid).toHaveLength(0);
    expect(invalid.map((i) => i.reason)).toEqual(["bad_turn_type", "bad_speaker", "bad_turn_index", "bad_turn_index", "bad_session", "bad_id", "not_object"]);
    expect(invalid[0].id).toBe(id(2));
    expect(invalid[5].id).toBeNull();
  });
  it("dedupes ids inside one batch and truncates long content", () => {
    const { valid } = validateTurns([turn(), turn(), turn({ id: id(2), content: "x".repeat(MAX_TURN_CONTENT + 5) })], "u");
    expect(valid).toHaveLength(2);
    expect(valid[1].content).toHaveLength(MAX_TURN_CONTENT);
  });
  it("caps batch size and nulls non-object metadata", () => {
    const many = Array.from({ length: MAX_TURNS_PER_REQUEST + 20 }, (_, i) => turn({ id: id(i + 1), metadata: "str" }));
    const { valid } = validateTurns(many, "u");
    expect(valid).toHaveLength(MAX_TURNS_PER_REQUEST);
    expect(valid[0].metadata).toBeNull();
  });
});

describe("partitionBySession", () => {
  it("splits on owned session ids", () => {
    const { valid } = validateTurns([turn({ session_id: "mine" }), turn({ id: id(2), session_id: "other" })], "u");
    const { accepted, missingSession } = partitionBySession(valid, new Set(["mine"]));
    expect(accepted.map((t) => t.session_id)).toEqual(["mine"]);
    expect(missingSession.map((t) => t.session_id)).toEqual(["other"]);
  });
});
