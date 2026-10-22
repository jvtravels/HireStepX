import { describe, it, expect } from "vitest";
import {
  ARCHIVE_REJECT_NOTE, archiveConfirmLabel, archiveDoneMessage, archiveUndoneMessage, rejectRemainingScope,
} from "../../app/(employer)/employer/jobs/_components/jobsHelpers";

describe("archive and reject copy", () => {
  it("counts who will be rejected and flags those in interviews", () => {
    expect(rejectRemainingScope(12, 3)).toBe("Up to 12 candidates will be rejected, including 3 in interviews.");
    expect(rejectRemainingScope(1, 0)).toBe("Up to 1 candidate will be rejected.");
    expect(rejectRemainingScope(5, null)).toBe("Up to 5 candidates will be rejected.");
    expect(rejectRemainingScope(0, null)).toContain("nothing will be rejected");
  });

  it("puts the count on the confirm button only when it rejects someone", () => {
    expect(archiveConfirmLabel(true, 12)).toBe("Archive and reject up to 12");
    expect(archiveConfirmLabel(true, 0)).toBe("Archive");
    expect(archiveConfirmLabel(false, 12)).toBe("Archive");
  });

  it("says plainly that archiving does not message candidates", () => {
    expect(ARCHIVE_REJECT_NOTE).toContain("doesn't send them a message");
  });

  it("words the result and the undo", () => {
    expect(archiveDoneMessage(3)).toBe("Job archived. 3 candidates marked rejected.");
    expect(archiveDoneMessage(0)).toBe("Job archived.");
    expect(archiveUndoneMessage(1)).toBe("Restored 1 candidate to their earlier status.");
  });
});
