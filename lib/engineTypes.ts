/** Types and legacy error class — WASM runs in worker via wasmBridge. */

export interface SplitConfig {
  span?: number;
  pages?: string;
}

export interface RotateConfig {
  rotation: 90 | 180 | 270;
  pages?: string;
}

export interface WatermarkConfig {
  text: string;
  opacity?: string;
  rotation?: string;
  pages?: string;
  onTop?: boolean;
  position?: string;
  fontSize?: number;
  color?: string;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SplitResult {
  from: number;
  thru: number;
  data: Uint8Array;
}

export class PdfcpuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfcpuError";
  }
}
