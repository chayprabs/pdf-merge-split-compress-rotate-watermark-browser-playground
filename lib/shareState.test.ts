import { describe, expect, it } from "vitest";
import { encodeState } from "./shareState";

describe("shareState", () => {
  it("encode prefixes state=", () => {
    const enc = encodeState({ operation: "merge" });
    expect(enc?.startsWith("state=")).toBe(true);
  });
});
