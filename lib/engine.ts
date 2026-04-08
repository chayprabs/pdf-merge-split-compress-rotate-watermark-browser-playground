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
    this.name = 'PdfcpuError';
  }
}

declare global {
  interface Window {
    Go: new () => GoInstance;
    pdfcpuMerge: (pdfs: Uint8Array[], config?: string) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuSplit: (pdf: Uint8Array, config?: string) => { ok: boolean; data?: string | Uint8Array; error?: string };
    pdfcpuRotate: (pdf: Uint8Array, config?: string) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuValidate: (pdf: Uint8Array) => { ok: boolean; data?: string; error?: string };
    pdfcpuOptimize: (pdf: Uint8Array) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuExtractPages: (pdf: Uint8Array, config?: string) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuAddWatermark: (pdf: Uint8Array, config?: string) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuRemovePages: (pdf: Uint8Array, config?: string) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuSetMetadata: (pdf: Uint8Array, config?: string) => { ok: boolean; data?: Uint8Array; error?: string };
    pdfcpuVersion: { version: string };
  }
}

interface GoInstance {
  run(instance: WebAssembly.Instance): Promise<void>;
  importObject: WebAssembly.Imports;
}

let wasmLoaded = false;
let wasmLoading: Promise<void> | null = null;

async function loadWasmExec(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('wasm_exec');
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'wasm_exec';
    script.src = '/wasm_exec.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load wasm_exec.js'));
    document.head.appendChild(script);
  });
}

async function loadWasmModule(): Promise<void> {
  const go = new window.Go();
  const response = await fetch('/engine-pdfcpu.wasm', {
    mode: 'cors',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WASM: ${response.status}`);
  }

  const result = await WebAssembly.instantiateStreaming(response, go.importObject);
  go.run(result.instance);
  wasmLoaded = true;
}

export async function waitForPdfcpuRuntime(): Promise<void> {
  const startTime = Date.now();
  const timeout = 10000;
  const pollInterval = 50;

  while (Date.now() - startTime < timeout) {
    if (wasmLoaded) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timeout waiting for pdfcpu runtime');
}

async function ensureRuntime(): Promise<void> {
  if (wasmLoaded) return;

  if (!wasmLoading) {
    wasmLoading = (async () => {
      await loadWasmExec();
      await loadWasmModule();
    })();
  }

  await wasmLoading;
}

function handleResult(result: { ok: boolean; data?: Uint8Array | string; error?: string }): Uint8Array {
  if (!result.ok) {
    throw new PdfcpuError(result.error || 'Unknown error');
  }
  if (!result.data) {
    throw new PdfcpuError('No data returned');
  }
  if (typeof result.data === 'string') {
    throw new PdfcpuError('Unexpected string result');
  }
  return result.data;
}

function handleStringResult(result: { ok: boolean; data?: string; error?: string }): string {
  if (!result.ok) {
    throw new PdfcpuError(result.error || 'Unknown error');
  }
  return result.data || '';
}

export async function mergePDFs(files: Uint8Array[], config?: { dividerPage?: boolean }): Promise<Uint8Array> {
  await ensureRuntime();
  const configStr = config ? JSON.stringify(config) : '';
  const result = window.pdfcpuMerge(files, configStr);
  return handleResult(result);
}

export async function splitPDF(file: Uint8Array, config?: SplitConfig): Promise<SplitResult[]> {
  await ensureRuntime();
  const configStr = config ? JSON.stringify(config) : '';
  const result = window.pdfcpuSplit(file, configStr);
  if (!result.ok) {
    throw new PdfcpuError(result.error || 'Unknown error');
  }
  if (typeof result.data !== 'string') {
    throw new PdfcpuError('Unexpected result format');
  }
  const parsed = JSON.parse(result.data);
  return parsed;
}

export async function rotatePDF(file: Uint8Array, degrees: 90 | 180 | 270, pages?: number[]): Promise<Uint8Array> {
  await ensureRuntime();
  const config = JSON.stringify({ rotation: degrees, pages: pages?.join(',') });
  const result = window.pdfcpuRotate(file, config);
  return handleResult(result);
}

export async function validatePDF(file: Uint8Array): Promise<ValidationResult> {
  await ensureRuntime();
  const result = window.pdfcpuValidate(file);
  if (!result.ok) {
    return { valid: false, error: result.error };
  }
  return { valid: true };
}

export async function optimizePDF(file: Uint8Array): Promise<Uint8Array> {
  await ensureRuntime();
  const result = window.pdfcpuOptimize(file);
  return handleResult(result);
}

export async function extractPages(file: Uint8Array, pages: number[]): Promise<Uint8Array> {
  await ensureRuntime();
  const config = JSON.stringify({ pages: pages.join(',') });
  const result = window.pdfcpuExtractPages(file, config);
  return handleResult(result);
}

export async function removePages(file: Uint8Array, pages: number[]): Promise<Uint8Array> {
  await ensureRuntime();
  const config = JSON.stringify({ pages: pages.join(',') });
  const result = window.pdfcpuRemovePages(file, config);
  return handleResult(result);
}

export async function addWatermark(file: Uint8Array, config: WatermarkConfig): Promise<Uint8Array> {
  await ensureRuntime();
  const configStr = JSON.stringify(config);
  const result = window.pdfcpuAddWatermark(file, configStr);
  return handleResult(result);
}

export async function setMetadata(file: Uint8Array, meta: PDFMetadata): Promise<Uint8Array> {
  await ensureRuntime();
  const configStr = JSON.stringify(meta);
  const result = window.pdfcpuSetMetadata(file, configStr);
  return handleResult(result);
}

export function downloadPDF(data: Uint8Array, filename: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getVersion(): string {
  return window.pdfcpuVersion?.version || 'unknown';
}