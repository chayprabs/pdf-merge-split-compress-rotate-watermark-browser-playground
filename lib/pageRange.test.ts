import { describe, expect, it } from "vitest";
import {
  isValidPageRangeSyntax,
  maxPageInRange,
  pageRangeExceedsDocument,
} from "./pageRange";

describe("pageRange", () => {
  it("accepts PRD examples", () => {
    expect(isValidPageRangeSyntax("1-3, 5, 7-9")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidPageRangeSyntax("abc")).toBe(false);
    expect(isValidPageRangeSyntax("")).toBe(false);
    expect(isValidPageRangeSyntax("0")).toBe(false);
    expect(isValidPageRangeSyntax("-3")).toBe(false);
    expect(isValidPageRangeSyntax("9-1")).toBe(false);
  });

  it("detects page range overflow", () => {
    expect(pageRangeExceedsDocument("1-3, 5", 4)).toBe(true);
    expect(pageRangeExceedsDocument("1-2", 4)).toBe(false);
    expect(maxPageInRange("7-9")).toBe(9);
  });
});
