export const WORKER_OP_TIMEOUT_MS = 60_000;

export const PRD = {
  timeout: "Processing timed out. Try a smaller file or simpler operation.",
  engineLoading: "Engine is still loading. Please wait.",
  engineRestarted:
    "An unexpected error occurred. The engine has been restarted.",
  genericWasm:
    "Could not process the file. It may be corrupted or password-protected.",
} as const;

export class PdfEngineError extends Error {
  constructor(
    message: string,
    readonly code?: "timeout" | "worker_crash" | "not_ready",
  ) {
    super(message);
    this.name = "PdfEngineError";
  }
}

export type WorkerOp =
  | "pageCount"
  | "validate"
  | "merge"
  | "split"
  | "extractPages"
  | "removePages"
  | "optimize"
  | "rotate"
  | "watermark"
  | "setMetadata";

export interface SplitPartMeta {
  from: number;
  thru: number;
}

export interface RunResult {
  buffer?: ArrayBuffer;
  buffers?: ArrayBuffer[];
  splitMeta?: SplitPartMeta[];
  pageCount?: number;
}

interface WorkerInitOk {
  type: "ready";
}

interface WorkerInitErr {
  type: "initError";
  error: string;
}

interface WorkerDone {
  type: "done";
  id: number;
  ok: boolean;
  error?: string;
  buffer?: ArrayBuffer;
  buffers?: ArrayBuffer[];
  splitMeta?: SplitPartMeta[];
  pageCount?: number;
}

type WorkerMsg = WorkerInitOk | WorkerInitErr | WorkerDone;

function mapEngineError(raw: string): string {
  const rawMsg = raw || "";
  const exceeds = /page range exceeds the document's (\d+) pages/i.exec(rawMsg);
  if (exceeds) {
    return `Page range exceeds the document's ${exceeds[1]} pages.`;
  }
  const s = rawMsg.toLowerCase();
  if (
    s.includes("password") ||
    s.includes("encrypt") ||
    s.includes("decrypt") ||
    s.includes("corrupt") ||
    s.includes("validation failed") ||
    s.includes("invalid page")
  ) {
    return PRD.genericWasm;
  }
  if (s.includes("invalid span") || s.includes("invalid page range")) {
    return "Invalid page range. Use formats like 1-3, 5, 7-9.";
  }
  if (s.includes("go program has already exited")) {
    return PRD.engineRestarted;
  }
  if (rawMsg.trim()) return rawMsg;
  return PRD.genericWasm;
}

let bridgeInstance: WasmBridge | null = null;

export function getWasmBridge(): WasmBridge {
  if (!bridgeInstance) bridgeInstance = new WasmBridge();
  return bridgeInstance;
}

export class WasmBridge {
  readonly engineVersion = "0.11.1";
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private nextId = 1;
  private opChain: Promise<unknown> = Promise.resolve();
  private readonly pending = new Map<
    number,
    {
      resolve: (v: RunResult) => void;
      reject: (e: Error) => void;
    }
  >();

  private baseUrl(): string {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }

  private spawnWorker(): Worker {
    const w = new Worker(`${this.baseUrl()}/pdf-worker.js`);
    w.onmessage = (ev: MessageEvent<WorkerMsg>) => {
      const msg = ev.data;
      if (msg.type === "done") {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (!msg.ok) {
          p.reject(
            new PdfEngineError(mapEngineError(msg.error || ""), "worker_crash"),
          );
          return;
        }
        p.resolve({
          buffer: msg.buffer,
          buffers: msg.buffers,
          splitMeta: msg.splitMeta,
          pageCount:
            typeof msg.pageCount === "number" ? msg.pageCount : undefined,
        });
        return;
      }
    };
    w.onerror = () => {
      for (const [, pr] of this.pending) {
        pr.reject(new PdfEngineError(PRD.engineRestarted, "worker_crash"));
      }
      this.pending.clear();
      this.worker = null;
      this.readyPromise = null;
    };
    return w;
  }

  async ensureReady(): Promise<void> {
    if (typeof window === "undefined") {
      throw new PdfEngineError("WASM only runs in the browser");
    }
    if (!this.readyPromise) {
      this.readyPromise = new Promise((resolve, reject) => {
        try {
          this.worker = this.spawnWorker();
        } catch (e) {
          reject(e);
          return;
        }

        const w = this.worker!;

        const onMsg = (ev: MessageEvent<WorkerMsg>) => {
          const msg = ev.data;
          if (msg.type === "ready") {
            w.removeEventListener("message", onMsg);
            resolve();
            return;
          }
          if (msg.type === "initError") {
            w.removeEventListener("message", onMsg);
            reject(new PdfEngineError(msg.error || "WASM init failed"));
          }
        };
        w.addEventListener("message", onMsg);
        w.postMessage({
          type: "init",
          wasmUrl: `${this.baseUrl()}/engine-pdfcpu.wasm`,
        });
      });
    }
    return this.readyPromise;
  }

  private async restartWorker(): Promise<void> {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        /* ignore */
      }
    }
    this.worker = null;
    this.readyPromise = null;
    await this.ensureReady();
  }

  private runOnce(
    op: WorkerOp,
    fileBuffers: ArrayBuffer[],
    options: Record<string, unknown>,
    runOpts: { transfer?: boolean },
  ): Promise<RunResult> {
    const id = this.nextId++;
    const useTransfer = runOpts.transfer !== false;
    const transfer = useTransfer ? fileBuffers.slice() : [];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        try {
          this.worker?.terminate();
        } catch {
          /* */
        }
        this.worker = null;
        this.readyPromise = null;
        void this.restartWorker();
        reject(new PdfEngineError(PRD.timeout, "timeout"));
      }, WORKER_OP_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      const msg = {
        type: "run" as const,
        id,
        op,
        files: fileBuffers,
        options,
      };
      if (transfer.length) {
        this.worker!.postMessage(msg, transfer);
      } else {
        this.worker!.postMessage(msg);
      }
    });
  }

  async run(
    op: WorkerOp,
    fileBuffers: ArrayBuffer[],
    options: Record<string, unknown> = {},
    runOpts: { transfer?: boolean } = {},
  ): Promise<RunResult> {
    await this.ensureReady();
    const task = () => this.runOnce(op, fileBuffers, options, runOpts);
    const result = this.opChain.then(task, task);
    this.opChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** After a crash, call to load a fresh worker. */
  async recover(): Promise<void> {
    await this.restartWorker();
  }
}

export async function pageCountPdf(buffer: ArrayBuffer): Promise<number> {
  const br = getWasmBridge();
  const buf = buffer.slice(0);
  const out = await br.run("pageCount", [buf], {}, { transfer: false });
  if (typeof out.pageCount !== "number") {
    throw new PdfEngineError(PRD.genericWasm);
  }
  return out.pageCount;
}

export async function validatePdfBuffer(
  buffer: ArrayBuffer,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const br = getWasmBridge();
    const buf = buffer.slice(0);
    await br.run("validate", [buf], {}, { transfer: false });
    return { valid: true };
  } catch (e) {
    const error =
      e instanceof PdfEngineError ? e.message : PRD.genericWasm;
    return { valid: false, error };
  }
}
