import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

export const MAX_URL_STATE_CHARS = 2000;

export type SplitMode = "range" | "every" | "extract" | "remove";

export type OperationId =
  | "merge"
  | "split"
  | "compress"
  | "rotate"
  | "watermark"
  | "metadata";

export interface ShareableState {
  operation: OperationId;
  mergeOutputName?: string;
  mergeDividerPage?: boolean;
  splitMode?: SplitMode;
  splitRange?: string;
  splitEveryN?: number;
  splitExtractPages?: string;
  splitRemovePages?: string;
  splitOutputName?: string;
  compressQuality?: "low" | "medium" | "high";
  compressOutputName?: string;
  rotateAngle?: 90 | 180 | 270;
  rotateAllPages?: boolean;
  rotatePages?: string;
  rotateOutputName?: string;
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
  wmAllPages?: boolean;
  wmPages?: string;
  wmOnTop?: boolean;
  wmOutputName?: string;
  metaTitle?: string;
  metaAuthor?: string;
  metaSubject?: string;
  metaKeywords?: string;
  metaCreator?: string;
  metaOutputName?: string;
}

const HASH_PREFIX = "state=";

const OPS: OperationId[] = [
  "merge",
  "split",
  "compress",
  "rotate",
  "watermark",
  "metadata",
];
const WM_POS = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
const COMPRESS_Q = ["low", "medium", "high"] as const;
const SPLIT_MODES: SplitMode[] = ["range", "every", "extract", "remove"];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

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

export function validateShareableState(raw: unknown): ShareableState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.operation !== "string" ||
    !OPS.includes(o.operation as OperationId)
  )
    return null;

  const state: ShareableState = { operation: o.operation as OperationId };

  if (typeof o.mergeOutputName === "string")
    state.mergeOutputName = o.mergeOutputName.slice(0, 200);
  if (typeof o.mergeDividerPage === "boolean")
    state.mergeDividerPage = o.mergeDividerPage;
  if (
    typeof o.splitMode === "string" &&
    SPLIT_MODES.includes(o.splitMode as SplitMode)
  )
    state.splitMode = o.splitMode as SplitMode;
  if (typeof o.splitRange === "string") state.splitRange = o.splitRange;
  if (typeof o.splitEveryN === "number" && o.splitEveryN >= 1)
    state.splitEveryN = Math.floor(o.splitEveryN);
  if (typeof o.splitExtractPages === "string")
    state.splitExtractPages = o.splitExtractPages;
  if (typeof o.splitRemovePages === "string")
    state.splitRemovePages = o.splitRemovePages;
  if (typeof o.splitOutputName === "string")
    state.splitOutputName = o.splitOutputName.slice(0, 200);
  if (
    typeof o.compressQuality === "string" &&
    COMPRESS_Q.includes(o.compressQuality as (typeof COMPRESS_Q)[number])
  )
    state.compressQuality =
      o.compressQuality as ShareableState["compressQuality"];
  if (typeof o.compressOutputName === "string")
    state.compressOutputName = o.compressOutputName.slice(0, 200);
  if (o.rotateAngle === 90 || o.rotateAngle === 180 || o.rotateAngle === 270)
    state.rotateAngle = o.rotateAngle;
  if (typeof o.rotateAllPages === "boolean")
    state.rotateAllPages = o.rotateAllPages;
  if (typeof o.rotatePages === "string") state.rotatePages = o.rotatePages;
  if (typeof o.rotateOutputName === "string")
    state.rotateOutputName = o.rotateOutputName.slice(0, 200);
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
    state.wmRotation = clamp(Math.round(o.wmRotation), 0, 360);
  if (typeof o.wmAllPages === "boolean") state.wmAllPages = o.wmAllPages;
  if (typeof o.wmPages === "string") state.wmPages = o.wmPages;
  if (typeof o.wmOnTop === "boolean") state.wmOnTop = o.wmOnTop;
  if (typeof o.wmOutputName === "string")
    state.wmOutputName = o.wmOutputName.slice(0, 200);
  if (typeof o.metaTitle === "string")
    state.metaTitle = o.metaTitle.slice(0, 200);
  if (typeof o.metaAuthor === "string")
    state.metaAuthor = o.metaAuthor.slice(0, 200);
  if (typeof o.metaSubject === "string")
    state.metaSubject = o.metaSubject.slice(0, 200);
  if (typeof o.metaKeywords === "string")
    state.metaKeywords = o.metaKeywords.slice(0, 500);
  if (typeof o.metaCreator === "string")
    state.metaCreator = o.metaCreator.slice(0, 200);
  if (typeof o.metaOutputName === "string")
    state.metaOutputName = o.metaOutputName.slice(0, 200);

  return state;
}

export function decodeStateFromHash(): ShareableState | null {
  if (typeof window === "undefined") return null;
  let h = window.location.hash.replace(/^#/, "");
  if (!h.startsWith(HASH_PREFIX)) return null;
  h = h.slice(HASH_PREFIX.length);
  try {
    const json = decompressFromEncodedURIComponent(h);
    if (!json) return null;
    return validateShareableState(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
