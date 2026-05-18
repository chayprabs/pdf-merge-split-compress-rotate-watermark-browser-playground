import { describe, expect, it } from "vitest";
import {
  sanitizeFilename,
  validatePdfFile,
  wouldExceedTotal,
} from "./fileUtils";

describe("fileUtils", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../x.pdf")).toBe("x.pdf");
    expect(sanitizeFilename("")).toBe("output.pdf");
    expect(
      sanitizeFilename("a".repeat(120) + ".pdf").length,
    ).toBeLessThanOrEqual(104);
  });

  it("rejects non-pdf extension", () => {
    const f = new File([""], "x.txt", { type: "application/pdf" });
    expect(validatePdfFile(f).ok).toBe(false);
  });

  it("detects total size limit", () => {
    const a = new File([new Uint8Array(400 * 1024 * 1024)], "a.pdf", {
      type: "application/pdf",
    });
    const b = new File([new Uint8Array(150 * 1024 * 1024)], "b.pdf", {
      type: "application/pdf",
    });
    expect(wouldExceedTotal([a], [b])).toBe(true);
  });
});
