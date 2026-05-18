import { describe, expect, it } from "vitest";
import { isValidPageRangeSyntax } from "./pageRange";

describe("pageRange", () => {
  it("accepts PRD examples", () => {
    expect(isValidPageRangeSyntax("1-3, 5, 7-9")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidPageRangeSyntax("abc")).toBe(false);
    expect(isValidPageRangeSyntax("")).toBe(false);
  });
});
