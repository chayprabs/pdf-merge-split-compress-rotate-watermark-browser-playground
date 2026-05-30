import { describe, expect, it } from "vitest";
import { encodeState, validateShareableState } from "./shareState";

describe("shareState", () => {
  it("encode prefixes state=", () => {
    const enc = encodeState({ operation: "merge" });
    expect(enc?.startsWith("state=")).toBe(true);
  });

  it("validateShareableState rejects invalid operation", () => {
    expect(validateShareableState({ operation: "hack" })).toBeNull();
  });

  it("validateShareableState clamps watermark values", () => {
    const s = validateShareableState({
      operation: "watermark",
      wmOpacityPct: 500,
      wmFontSize: 5,
      wmRotation: 200,
    });
    expect(s?.wmOpacityPct).toBe(100);
    expect(s?.wmFontSize).toBe(12);
    expect(s?.wmRotation).toBe(200);
  });

  it("validateShareableState accepts metadata operation", () => {
    const s = validateShareableState({
      operation: "metadata",
      metaTitle: "Hello",
    });
    expect(s?.operation).toBe("metadata");
    expect(s?.metaTitle).toBe("Hello");
  });
});
