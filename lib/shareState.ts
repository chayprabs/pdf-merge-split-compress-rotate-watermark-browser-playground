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
    const raw = JSON.parse(json) as unknown;
    return validateShareableState(raw);
  } catch {
    return null;
  }
}

const OPS: OperationId[] = [
  "merge",
  "split",
  "compress",
  "rotate",
  "watermark",
];
const WM_POS = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
const COMPRESS_Q = ["low", "medium", "high"] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function validateShareableState(raw: unknown): ShareableState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.operation !== "string" || !OPS.includes(o.operation as OperationId))
    return null;

  const state: ShareableState = { operation: o.operation as OperationId };

  if (typeof o.mergeOutputName === "string")
    state.mergeOutputName = o.mergeOutputName.slice(0, 200);
  if (o.splitMode === "range" || o.splitMode === "every")
    state.splitMode = o.splitMode;
  if (typeof o.splitRange === "string") state.splitRange = o.splitRange;
  if (typeof o.splitEveryN === "number" && o.splitEveryN >= 1)
    state.splitEveryN = Math.floor(o.splitEveryN);
  if (
    typeof o.compressQuality === "string" &&
    COMPRESS_Q.includes(o.compressQuality as (typeof COMPRESS_Q)[number])
  )
    state.compressQuality = o.compressQuality as ShareableState["compressQuality"];
  if (o.rotateAngle === 90 || o.rotateAngle === 180 || o.rotateAngle === 270)
    state.rotateAngle = o.rotateAngle;
  if (typeof o.rotateAllPages === "boolean")
    state.rotateAllPages = o.rotateAllPages;
  if (typeof o.rotatePages === "string") state.rotatePages = o.rotatePages;
  if (typeof o.wmText === "string") state.wmText = o.wmText.slice(0, 200);
  if (
    typeof o.wmPosition === "string" &&
    WM_POS.includes(o.wmPosition as (typeof WM_POS)[number])
  )
    state.wmPosition = o.wmPosition as ShareableState["wmPosition"];
  if (typeof o.wmOpacityPct === "number")
    state.wmOpacityPct = clamp(Math.round(o.wmOpacityPct), 0, 100);
  if (typeof o.wmFontSize === "number")
    state.wmFontSize = clamp(Math.round(o.wmFontSize), 12, 120);
  if (typeof o.wmColor === "string" && /^#[0-9a-fA-F]{6}$/.test(o.wmColor))
    state.wmColor = o.wmColor;
  if (typeof o.wmRotation === "number")
    state.wmRotation = clamp(Math.round(o.wmRotation), 0, 90);

  return state;
}
