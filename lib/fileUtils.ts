export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const WARN_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
export const MAX_OUTPUT_NAME_LEN = 100;

export const MSG = {
  wrongType: "Only PDF files are accepted.",
  fileTooLarge: "File is too large. Maximum is 200 MB.",
  totalTooLarge: "Total file size exceeds 500 MB.",
  emptyOnRun: "Add at least one PDF file.",
  mergeMin: "Select at least 2 files to merge.",
  mergeMax: "Too many files. Maximum is 20.",
  splitOne: "Select exactly 1 file to split.",
  splitRangeInvalid: "Invalid page range. Use formats like 1-3, 5, 7-9.",
  splitRangeExceeds: (n: number) =>
    `Page range exceeds the document's ${n} pages.`,
  splitNInvalid: "Enter a valid page count.",
  compressMax: "Too many files. Maximum is 10 for compression.",
  rotateOne: "Select exactly 1 file to rotate.",
  wmOne: "Select exactly 1 file to watermark.",
  wmEmpty: "Enter watermark text.",
  wmLong: "Watermark text must be 200 characters or fewer.",
  largeWarn: "Large file — processing may be slow",
} as const;

export interface FileAcceptance {
  ok: boolean;
  file?: File;
  error?: string;
  warn?: string;
}

function hasPdfExtension(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return lower.endsWith(".pdf");
}

function isPdfMime(mime: string, name: string): boolean {
  if (mime === "application/pdf") return true;
  if (mime === "" || mime === "application/octet-stream") {
    return hasPdfExtension(name);
  }
  return false;
}

/** Validate a single dropped/selected file (MIME + extension). */
export function validatePdfFile(file: File): FileAcceptance {
  if (!hasPdfExtension(file.name)) {
    return { ok: false, error: MSG.wrongType };
  }
  if (!isPdfMime(file.type, file.name)) {
    return { ok: false, error: MSG.wrongType };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: MSG.fileTooLarge };
  }
  const warn = file.size >= WARN_FILE_BYTES ? MSG.largeWarn : undefined;
  return { ok: true, file, warn };
}

/** Current total size of accepted queue + new candidates. */
export function totalSizeBytes(files: File[]): number {
  return files.reduce((s, f) => s + f.size, 0);
}

export function wouldExceedTotal(
  currentFiles: File[],
  newFiles: File[],
): boolean {
  return totalSizeBytes([...currentFiles, ...newFiles]) > MAX_TOTAL_BYTES;
}

export function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read failed"));
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.readAsArrayBuffer(file);
  });
}

export function sanitizeFilename(
  name: string,
  fallback = "output.pdf",
): string {
  let s = name.replace(/[/\\]/g, "").replace(/\0/g, "");
  s = s.replace(/^\.+/, "");
  if (s.length > MAX_OUTPUT_NAME_LEN) {
    s = s.slice(0, MAX_OUTPUT_NAME_LEN);
  }
  const base = s.trim() || fallback;
  if (!base.toLowerCase().endsWith(".pdf")) {
    return base.endsWith(".") ? `${base.slice(0, -1)}.pdf` : `${base}.pdf`;
  }
  return base;
}
