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
    if (/^-?\d+$/u.test(p)) continue;
    const m = /^(\d+)-(\d+)$/u.exec(p);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (a < 1 || b < 1) return false;
      continue;
    }
    return false;
  }
  return true;
}
