import { describe, it, expect } from "vitest";
import { detectEmailProvider } from "../auth/_shell";

describe("detectEmailProvider", () => {
  it("maps consumer webmail domains", () => {
    expect(detectEmailProvider("a@gmail.com")?.name).toBe("Gmail");
    expect(detectEmailProvider("a@hotmail.co.uk")?.name).toBe("Outlook");
    expect(detectEmailProvider("a@yahoo.co.in")?.name).toBe("Yahoo");
    expect(detectEmailProvider("a@icloud.com")?.name).toBe("iCloud");
    expect(detectEmailProvider("a@me.com")?.name).toBe("iCloud");
  });

  it("does not misclassify company domains that merely contain a provider string", () => {
    expect(detectEmailProvider("priya@acme.com")).toBeNull();
    expect(detectEmailProvider("a@olive.com")).toBeNull();
    expect(detectEmailProvider("a@homeme.com")).toBeNull();
  });
});
