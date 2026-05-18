import { zipSync } from "fflate";

export function buildZip(
  entries: { name: string; data: Uint8Array }[],
): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const e of entries) {
    files[e.name] = e.data;
  }
  return zipSync(files);
}

export function triggerDownload(
  data: Uint8Array,
  mime: string,
  filename: string,
): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
