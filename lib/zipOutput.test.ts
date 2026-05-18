import { describe, expect, it } from "vitest";
import { buildZip } from "./zipOutput";

describe("zipOutput", () => {
  it("builds a zip with one entry", () => {
    const z = buildZip([{ name: "a.pdf", data: new Uint8Array([1, 2, 3]) }]);
    expect(z.byteLength).toBeGreaterThan(10);
  });
});
