/* eslint-disable */
/* global Go */
importScripts("/wasm_exec.js");

const go = new self.Go();

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

/**
 * @param {any} payload
 * @returns {{ type: string, id?: number, ok?: boolean, error?: string, buffer?: ArrayBuffer, buffers?: ArrayBuffer[], splitMeta?: {from:number,thru:number}[], pageCount?: number }}
 */
function runOp(payload) {
  const { id, op, files, options } = payload;
  try {
    if (op === "pageCount") {
      const pdf = new Uint8Array(files[0]);
      const r = self.pdfcpuPageCount(pdf);
      if (!r.ok) throw new Error(r.error || "pageCount failed");
      return { type: "done", id, ok: true, pageCount: r.data };
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

    throw new Error(`unknown op: ${op}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { type: "done", id, ok: false, error: msg };
  }
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === "init") {
    try {
      const wasmUrl = msg.wasmUrl || "/engine-pdfcpu.wasm";
      const res = await fetch(wasmUrl);
      if (!res.ok) throw new Error(`WASM fetch ${res.status}`);
      const bytes = await res.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, go.importObject);
      go.run(result.instance);
      self.postMessage({ type: "ready" });
    } catch (e) {
      self.postMessage({ type: "initError", error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (msg.type === "run") {
    const out = runOp(msg);
    const xfer = [];
    if (out.buffer) xfer.push(out.buffer);
    if (out.buffers) xfer.push(...out.buffers);
    if (xfer.length) self.postMessage(out, xfer);
    else self.postMessage(out);
  }
};
