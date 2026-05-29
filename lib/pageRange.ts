/**
 * Validate page selection strings like "1-3, 5, 7-9" (comma-separated tokens).
 * Returns false for empty, invalid characters, or obviously bad tokens.
 */
export function isValidPageRangeSyntax(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (!/^[\d\s,\-]+$/u.test(t)) return false;
  const parts = t
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  for (const p of parts) {
    if (/^\d+$/u.test(p)) {
      if (parseInt(p, 10) < 1) return false;
      continue;
    }
    const m = /^(\d+)-(\d+)$/u.exec(p);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (a < 1 || b < 1 || a > b) return false;
      continue;
    }
    return false;
  }
  return true;
}

/** Highest page number referenced in a range string (1-based). */
export function maxPageInRange(s: string): number | null {
  if (!isValidPageRangeSyntax(s)) return null;
  let max = 0;
  for (const part of s.split(",").map((p) => p.trim()).filter(Boolean)) {
    const single = /^(\d+)$/u.exec(part);
    if (single) {
      max = Math.max(max, parseInt(single[1], 10));
      continue;
    }
    const range = /^(\d+)-(\d+)$/u.exec(part);
    if (range) {
      max = Math.max(max, parseInt(range[1], 10), parseInt(range[2], 10));
    }
  }
  return max > 0 ? max : null;
}

export function pageRangeExceedsDocument(
  range: string,
  pageCount: number,
): boolean {
  const max = maxPageInRange(range);
  if (max === null) return false;
  return max > pageCount;
}
