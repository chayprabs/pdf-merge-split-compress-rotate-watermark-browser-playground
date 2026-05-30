/* eslint-disable */
/* global Go */
importScripts("/wasm_exec.js");

let wasmUrl = "/engine-pdfcpu.wasm";
let wasmReady = false;
let loadPromise = null;
let opChain = Promise.resolve();

function copyWasmBytes(u8) {
  if (!u8 || !u8.byteLength) return null;
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}

function b64ToArrayBuffer(b64) {
  const bin = self.atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const out = new ArrayBuffer(u8.length);
  new Uint8Array(out).set(u8);
  return out;
}

async function loadWasm() {
  if (wasmReady) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const go = new self.Go();
    const res = await fetch(wasmUrl);
    if (!res.ok) throw new Error(`WASM fetch ${res.status}`);
    const bytes = await res.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, go.importObject);
    go.run(result.instance);
    wasmReady = true;
    loadPromise = null;
  })();
  return loadPromise;
}

async function ensureWasm() {
  try {
    await loadWasm();
  } catch (e) {
    wasmReady = false;
    loadPromise = null;
    throw e;
  }
}

async function reloadWasm() {
  wasmReady = false;
  loadPromise = null;
  await loadWasm();
}

function goExited(msg) {
  return /go program has already exited/i.test(msg);
}

/**
 * @param {any} payload
 */
function runOp(payload) {
  const { id, op, files, options } = payload;

  if (op === "pageCount") {
    const pdf = new Uint8Array(files[0]);
    const r = self.pdfcpuPageCount(pdf);
    if (!r.ok) throw new Error(r.error || "pageCount failed");
    return { type: "done", id, ok: true, pageCount: Number(r.data) };
  }

  if (op === "merge") {
    const arr = files.map((b) => new Uint8Array(b));
    const cfg = options?.configJson ?? "";
    const r = self.pdfcpuMerge(arr, cfg);
    if (!r.ok) throw new Error(r.error || "merge failed");
    const buffer = copyWasmBytes(r.data);
    if (!buffer) throw new Error("empty merge result");
    return { type: "done", id, ok: true, buffer };
  }

  if (op === "split") {
    const pdf = new Uint8Array(files[0]);
    const cfg = options?.configJson ?? "";
    const r = self.pdfcpuSplit(pdf, cfg);
    if (!r.ok) throw new Error(r.error || "split failed");
    const parsed = JSON.parse(r.data);
    const splitMeta = [];
    const buffers = [];
    for (const p of parsed) {
      splitMeta.push({ from: p.from, thru: p.thru });
      buffers.push(b64ToArrayBuffer(p.data));
    }
    return { type: "done", id, ok: true, buffers, splitMeta };
  }

  if (op === "optimize") {
    const quality = options?.quality ?? "medium";
    const buffers = [];
    for (const b of files) {
      const r = self.pdfcpuOptimize(new Uint8Array(b), JSON.stringify({ quality }));
      if (!r.ok) throw new Error(r.error || "optimize failed");
      const buf = copyWasmBytes(r.data);
      if (!buf) throw new Error("empty optimize result");
      buffers.push(buf);
    }
    return { type: "done", id, ok: true, buffers };
  }

  if (op === "rotate") {
    const pdf = new Uint8Array(files[0]);
    const cfg = options?.configJson ?? "";
    const r2 = self.pdfcpuRotate(pdf, cfg);
    if (!r2.ok) throw new Error(r2.error || "rotate failed");
    const buffer = copyWasmBytes(r2.data);
    if (!buffer) throw new Error("empty rotate result");
    return { type: "done", id, ok: true, buffer };
  }

  if (op === "watermark") {
    const pdf = new Uint8Array(files[0]);
    const cfg = options?.configJson ?? "";
    const r = self.pdfcpuAddWatermark(pdf, cfg);
    if (!r.ok) throw new Error(r.error || "watermark failed");
    const buffer = copyWasmBytes(r.data);
    if (!buffer) throw new Error("empty watermark result");
    return { type: "done", id, ok: true, buffer };
  }

  if (op === "validate") {
    const pdf = new Uint8Array(files[0]);
    const r = self.pdfcpuValidate(pdf);
    if (!r.ok) throw new Error(r.error || "validate failed");
    return { type: "done", id, ok: true, valid: true };
  }

  if (op === "extractPages") {
    const pdf = new Uint8Array(files[0]);
    const cfg = options?.configJson ?? "";
    const r = self.pdfcpuExtractPages(pdf, cfg);
    if (!r.ok) throw new Error(r.error || "extractPages failed");
    const buffer = copyWasmBytes(r.data);
    if (!buffer) throw new Error("empty extractPages result");
    return { type: "done", id, ok: true, buffer };
  }

  if (op === "removePages") {
    const pdf = new Uint8Array(files[0]);
    const cfg = options?.configJson ?? "";
    const r = self.pdfcpuRemovePages(pdf, cfg);
    if (!r.ok) throw new Error(r.error || "removePages failed");
    const buffer = copyWasmBytes(r.data);
    if (!buffer) throw new Error("empty removePages result");
    return { type: "done", id, ok: true, buffer };
  }

  if (op === "setMetadata") {
    const pdf = new Uint8Array(files[0]);
    const cfg = options?.configJson ?? "";
    const r = self.pdfcpuSetMetadata(pdf, cfg);
    if (!r.ok) throw new Error(r.error || "setMetadata failed");
    const buffer = copyWasmBytes(r.data);
    if (!buffer) throw new Error("empty setMetadata result");
    return { type: "done", id, ok: true, buffer };
  }

  throw new Error(`unknown op: ${op}`);
}

async function runOpSafe(payload) {
  await ensureWasm();
  try {
    return runOp(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (goExited(msg)) {
      await reloadWasm();
      return runOp(payload);
    }
    throw e;
  }
}

function postRunResult(out) {
  const xfer = [];
  if (out.buffer) xfer.push(out.buffer);
  if (out.buffers) xfer.push(...out.buffers);
  if (xfer.length) self.postMessage(out, xfer);
  else self.postMessage(out);
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "init") {
    wasmUrl = msg.wasmUrl || wasmUrl;
    wasmReady = false;
    loadPromise = null;
    loadWasm()
      .then(() => {
        const engineVersion =
          typeof self.pdfcpuVersion?.version === "string"
            ? self.pdfcpuVersion.version
            : "unknown";
        self.postMessage({ type: "ready", engineVersion });
      })
      .catch((e) => {
        self.postMessage({
          type: "initError",
          error: e instanceof Error ? e.message : String(e),
        });
      });
    return;
  }

  if (msg.type === "run") {
    opChain = opChain
      .then(async () => {
        try {
          const out = await runOpSafe(msg);
          postRunResult(out);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          postRunResult({
            type: "done",
            id: msg.id,
            ok: false,
            error: errMsg,
          });
        }
      })
      .catch(() => {});
  }
};
