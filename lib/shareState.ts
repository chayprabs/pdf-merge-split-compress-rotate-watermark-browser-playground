import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

export const MAX_URL_STATE_CHARS = 2000;

export type OperationId =
  | "merge"
  | "split"
  | "compress"
  | "rotate"
  | "watermark";

export interface ShareableState {
  operation: OperationId;
  mergeOutputName?: string;
  splitMode?: "range" | "every";
  splitRange?: string;
  splitEveryN?: number;
  compressQuality?: "low" | "medium" | "high";
  rotateAngle?: 90 | 180 | 270;
  rotateAllPages?: boolean;
  rotatePages?: string;
  wmText?: string;
  wmPosition?:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  wmOpacityPct?: number;
  wmFontSize?: number;
  wmColor?: string;
  wmRotation?: number;
}

const HASH_PREFIX = "state=";

export function encodeState(state: ShareableState): string | null {
  try {
    const json = JSON.stringify(state);
    const packed = compressToEncodedURIComponent(json);
    const hash = `${HASH_PREFIX}${packed}`;
    if (hash.length > MAX_URL_STATE_CHARS) return null;
    return hash;
  } catch {
    return null;
  }
}

export function applyHashToLocation(hash: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = hash.startsWith("#") ? hash : `#${hash}`;
  window.history.replaceState(null, "", url.toString());
}

export function decodeStateFromHash(): ShareableState | null {
  if (typeof window === "undefined") return null;
  let h = window.location.hash.replace(/^#/, "");
  if (!h.startsWith(HASH_PREFIX)) return null;
  h = h.slice(HASH_PREFIX.length);
  try {
    const json = decompressFromEncodedURIComponent(h);
    if (!json) return null;
    return JSON.parse(json) as ShareableState;
  } catch {
    return null;
  }
}
