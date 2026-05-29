"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DropZone, type StagedFile } from "@/components/DropZone";
import {
  getWasmBridge,
  PdfEngineError,
  PRD,
  pageCountPdf,
  readFileArrayBuffer,
  sanitizeFilename,
  MSG,
  buildZip,
  triggerDownload,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "@/lib/engine";
import {
  isValidPageRangeSyntax,
  pageRangeExceedsDocument,
} from "@/lib/pageRange";
import type { OperationId, ShareableState } from "@/lib/shareState";
import {
  encodeState,
  decodeStateFromHash,
  applyHashToLocation,
} from "@/lib/shareState";

type EngineBadge = "loading" | "ready" | "processing" | "error";

interface QueueRow extends StagedFile {
  pageCount?: number;
}

interface PendingDownload {
  data: Uint8Array;
  mime: string;
  filename: string;
}

const OPS: { id: OperationId; label: string }[] = [
  { id: "merge", label: "Merge" },
  { id: "split", label: "Split" },
  { id: "compress", label: "Compress" },
  { id: "rotate", label: "Rotate" },
  { id: "watermark", label: "Watermark" },
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncName(name: string, max = 36): string {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

export function PressWorkspace() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [op, setOp] = useState<OperationId>("merge");
  const [badge, setBadge] = useState<EngineBadge>("loading");

  const [mergeOut, setMergeOut] = useState("merged.pdf");
  const [splitMode, setSplitMode] = useState<"range" | "every">("range");
  const [splitRange, setSplitRange] = useState("");
  const [splitEvery, setSplitEvery] = useState(1);
  const [compressQ, setCompressQ] = useState<"low" | "medium" | "high">("medium");
  const [rotAngle, setRotAngle] = useState<90 | 180 | 270>(90);
  const [rotAll, setRotAll] = useState(true);
  const [rotPages, setRotPages] = useState("");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmPos, setWmPos] = useState<
    "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  >("center");
  const [wmOpacity, setWmOpacity] = useState(30);
  const [wmSize, setWmSize] = useState(48);
  const [wmColor, setWmColor] = useState("#808080");
  const [wmRot, setWmRot] = useState(45);

  const [outPhase, setOutPhase] = useState<
    "idle" | "processing" | "success" | "error" | "timeout"
  >("idle");
  const [outMsg, setOutMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [pendingDownload, setPendingDownload] =
    useState<PendingDownload | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);

  const valids = useMemo(() => rows.filter((r) => !r.error), [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const resetOutput = useCallback(() => {
    runIdRef.current += 1;
    setOutPhase("idle");
    setOutMsg("");
    setPendingDownload(null);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (badge === "processing") setBadge("ready");
  }, [badge]);

  useEffect(() => {
    const decoded = decodeStateFromHash();
    if (!decoded) return;
    if (decoded.operation) setOp(decoded.operation);
    if (decoded.mergeOutputName) setMergeOut(decoded.mergeOutputName);
    if (decoded.splitMode) setSplitMode(decoded.splitMode);
    if (decoded.splitRange != null) setSplitRange(decoded.splitRange);
    if (decoded.splitEveryN != null) setSplitEvery(decoded.splitEveryN);
    if (decoded.compressQuality) setCompressQ(decoded.compressQuality);
    if (decoded.rotateAngle) setRotAngle(decoded.rotateAngle);
    if (decoded.rotateAllPages != null) setRotAll(decoded.rotateAllPages);
    if (decoded.rotatePages != null) setRotPages(decoded.rotatePages);
    if (decoded.wmText != null) setWmText(decoded.wmText);
    if (decoded.wmPosition) setWmPos(decoded.wmPosition);
    if (decoded.wmOpacityPct != null) setWmOpacity(decoded.wmOpacityPct);
    if (decoded.wmFontSize != null) setWmSize(decoded.wmFontSize);
    if (decoded.wmColor) setWmColor(decoded.wmColor);
    if (decoded.wmRotation != null) setWmRot(decoded.wmRotation);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await getWasmBridge().ensureReady();
        if (live) setBadge("ready");
      } catch {
        if (live) setBadge("error");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        await getWasmBridge().ensureReady();
        for (const r of rows) {
          if (r.error || cancelled) continue;
          if (r.pageCount !== undefined) continue;
          const id = r.id;
          try {
            const buf = await readFileArrayBuffer(r.file);
            const n = await pageCountPdf(buf);
            if (cancelled) return;
            setRows((prev) =>
              prev.map((x) => (x.id === id ? { ...x, pageCount: n } : x)),
            );
          } catch {
            if (cancelled) return;
            setRows((prev) =>
              prev.map((x) => (x.id === id ? { ...x, pageCount: -1 } : x)),
            );
          }
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [rows]);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
    },
    [],
  );

  const syncUrl = useCallback(() => {
    const state: ShareableState = {
      operation: op,
      mergeOutputName: mergeOut,
      splitMode,
      splitRange,
      splitEveryN: splitEvery,
      compressQuality: compressQ,
      rotateAngle: rotAngle,
      rotateAllPages: rotAll,
      rotatePages: rotPages,
      wmText,
      wmPosition: wmPos,
      wmOpacityPct: wmOpacity,
      wmFontSize: wmSize,
      wmColor,
      wmRotation: wmRot,
    };
    const hash = encodeState(state);
    if (hash) applyHashToLocation(hash);
    return hash;
  }, [
    op, mergeOut, splitMode, splitRange, splitEvery, compressQ,
    rotAngle, rotAll, rotPages, wmText, wmPos, wmOpacity, wmSize, wmColor, wmRot,
  ]);

  const onShare = useCallback(async () => {
    const hash = syncUrl();
    if (!hash) {
      setShareToast("Settings too long to share in a link.");
      window.setTimeout(() => setShareToast(null), 3500);
      return;
    }
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied. Files are not included.");
    } catch {
      setShareToast("Could not copy link. Copy the URL from your address bar.");
    }
    window.setTimeout(() => setShareToast(null), 3500);
  }, [syncUrl]);

  const validationError = useMemo(() => {
    if (valids.length === 0) return MSG.emptyOnRun;
    if (op === "merge") {
      if (valids.length < 2) return MSG.mergeMin;
      if (valids.length > 20) return MSG.mergeMax;
    }
    if (op === "split" || op === "rotate" || op === "watermark") {
      if (valids.length !== 1) {
        if (op === "split") return MSG.splitOne;
        if (op === "rotate") return MSG.rotateOne;
        return MSG.wmOne;
      }
    }
    if (op === "compress" && valids.length > 10) return MSG.compressMax;

    const pc = valids[0]?.pageCount;
    if (op === "split") {
      if (splitMode === "range") {
        if (!splitRange.trim()) return MSG.splitRangeInvalid;
        if (!isValidPageRangeSyntax(splitRange)) return MSG.splitRangeInvalid;
        if (pc === undefined) return "Loading page count…";
        if (pc < 0) return "Could not read page count for this PDF.";
        if (pageRangeExceedsDocument(splitRange, pc))
          return MSG.splitRangeExceeds(pc);
      } else {
        if (splitEvery < 1) return MSG.splitNInvalid;
        if (pc === undefined) return "Loading page count…";
        if (pc < 0) return "Could not read page count for this PDF.";
        if (splitEvery >= pc) return MSG.splitRangeExceeds(pc);
      }
    }
    if (op === "rotate" && !rotAll) {
      if (!rotPages.trim() || !isValidPageRangeSyntax(rotPages))
        return MSG.splitRangeInvalid;
      if (pc === undefined) return "Loading page count…";
      if (pc < 0) return "Could not read page count for this PDF.";
      if (pageRangeExceedsDocument(rotPages, pc))
        return MSG.splitRangeExceeds(pc);
    }
    if (op === "watermark") {
      if (!wmText.trim()) return MSG.wmEmpty;
      if (wmText.length > 200) return MSG.wmLong;
    }
    return null;
  }, [valids, op, splitMode, splitRange, splitEvery, rotAll, rotPages, wmText]);

  const canRun =
    badge === "ready" &&
    validationError === null &&
    outPhase !== "processing";

  const selectOperation = (id: OperationId) => {
    if (id === op) return;
    resetOutput();
    setOp(id);
    if (id === "split" || id === "rotate" || id === "watermark") {
      setRows((prev) => {
        const val = prev.filter((r) => !r.error);
        const err = prev.filter((r) => r.error);
        if (val.length <= 1) return prev;
        return [...err, val[0]];
      });
    }
  };

  const tabDisabled = (id: OperationId) => {
    if (id === "merge" || id === "compress") return false;
    return valids.length !== 1;
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const clearAll = () => {
    resetOutput();
    setRows([]);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (op !== "merge" && op !== "compress") return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((items) => {
      const err = items.filter((i) => i.error);
      const val = items.filter((i) => !i.error);
      const oldIdx = val.findIndex((i) => i.id === active.id);
      const newIdx = val.findIndex((i) => i.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return items;
      return [...err, ...arrayMove(val, oldIdx, newIdx)];
    });
  };

  const startProcessing = () => {
    setOutPhase("processing");
    setOutMsg("Processing…");
    setElapsed(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsed((x) => x + 1), 1000);
    setBadge("processing");
  };

  const stopProcessing = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setBadge("ready");
  };

  const onRun = async () => {
    if (badge === "loading") {
      setOutPhase("error");
      setOutMsg(PRD.engineLoading);
      return;
    }
    if (badge !== "ready" || !canRun || validationError) return;

    const thisRun = ++runIdRef.current;
    const bridge = getWasmBridge();
    setPendingDownload(null);
    startProcessing();

    try {
      if (op === "merge") {
        const buffers = await Promise.all(valids.map((v) => readFileArrayBuffer(v.file)));
        const res = await bridge.run("merge", buffers.map((b) => b.slice(0)), {
          configJson: JSON.stringify({ dividerPage: false }),
        }, { transfer: false });
        if (thisRun !== runIdRef.current) return;
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        const filename = sanitizeFilename(mergeOut || "merged.pdf");
        setPendingDownload({
          data: new Uint8Array(res.buffer),
          mime: "application/pdf",
          filename,
        });
        setOutPhase("success");
        setOutMsg(`Merged ${valids.length} files · ${fmtSize(res.buffer.byteLength)}`);
      } else if (op === "split") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const cfg = splitMode === "range"
          ? JSON.stringify({ pages: splitRange.trim(), span: 0 })
          : JSON.stringify({ span: splitEvery, pages: "" });
        const res = await bridge.run("split", [buf], { configJson: cfg });
        if (thisRun !== runIdRef.current) return;
        const parts = res.buffers || [];
        const meta = res.splitMeta || [];
        if (parts.length === 1) {
          setPendingDownload({
            data: new Uint8Array(parts[0]),
            mime: "application/pdf",
            filename: "split-1.pdf",
          });
        } else {
          const zip = buildZip(parts.map((b, i) => ({
            name: `split-${meta[i]?.from ?? i + 1}-${meta[i]?.thru ?? i + 1}.pdf`,
            data: new Uint8Array(b),
          })));
          setPendingDownload({ data: zip, mime: "application/zip", filename: "split-output.zip" });
        }
        setOutPhase("success");
        setOutMsg(`Split into ${parts.length} file(s)`);
      } else if (op === "compress") {
        const buffers = await Promise.all(valids.map((v) => readFileArrayBuffer(v.file)));
        const res = await bridge.run("optimize", buffers.map((b) => b.slice(0)), {
          quality: compressQ,
        }, { transfer: false });
        if (thisRun !== runIdRef.current) return;
        const outs = res.buffers || [];
        if (outs.length === 1) {
          const orig = valids[0].file.size;
          const comp = outs[0].byteLength;
          const pct = orig > 0 ? Math.round(((orig - comp) / orig) * 100) : 0;
          setPendingDownload({
            data: new Uint8Array(outs[0]),
            mime: "application/pdf",
            filename: "compressed.pdf",
          });
          setOutPhase("success");
          setOutMsg(pct > 0
            ? `Compressed to ${fmtSize(comp)} (${pct}% smaller)`
            : `Compressed to ${fmtSize(comp)}`);
        } else {
          const zip = buildZip(outs.map((b, i) => ({
            name: sanitizeFilename(valids[i].file.name.replace(/\.pdf$/i, "") + "-compressed.pdf"),
            data: new Uint8Array(b),
          })));
          setPendingDownload({ data: zip, mime: "application/zip", filename: "compressed.zip" });
          setOutPhase("success");
          setOutMsg(`Compressed ${outs.length} files`);
        }
      } else if (op === "rotate") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const res = await bridge.run("rotate", [buf], {
          configJson: JSON.stringify({ rotation: rotAngle, pages: rotAll ? "" : rotPages.trim() }),
        });
        if (thisRun !== runIdRef.current) return;
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        setPendingDownload({
          data: new Uint8Array(res.buffer),
          mime: "application/pdf",
          filename: "rotated.pdf",
        });
        setOutPhase("success");
        setOutMsg("Rotated PDF ready");
      } else if (op === "watermark") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const res = await bridge.run("watermark", [buf], {
          configJson: JSON.stringify({
            text: wmText,
            opacity: String(wmOpacity / 100),
            rotation: String(wmRot),
            onTop: true,
            position: wmPos,
            fontSize: wmSize,
            color: wmColor,
          }),
        });
        if (thisRun !== runIdRef.current) return;
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        setPendingDownload({
          data: new Uint8Array(res.buffer),
          mime: "application/pdf",
          filename: "watermarked.pdf",
        });
        setOutPhase("success");
        setOutMsg("Watermarked PDF ready");
      } else {
        throw new PdfEngineError("Unknown operation.");
      }
      stopProcessing();
    } catch (e) {
      if (thisRun !== runIdRef.current) return;
      stopProcessing();
      if (e instanceof PdfEngineError && e.code === "timeout") {
        setOutPhase("timeout");
        setOutMsg(PRD.timeout);
      } else {
        setOutPhase("error");
        setOutMsg(e instanceof PdfEngineError ? e.message : PRD.genericWasm);
      }
    }
  };

  const limitsHint = `PDF only · max ${fmtSize(MAX_FILE_BYTES)} per file · ${fmtSize(MAX_TOTAL_BYTES)} total`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="rounded-full px-3 py-1 text-xs font-medium"
          role="status"
          aria-live="polite"
        >
          {badge === "loading" && (
            <span className="text-neutral-500">Loading engine…</span>
          )}
          {badge === "ready" && (
            <span className="bg-emerald-50 text-emerald-700">Ready</span>
          )}
          {badge === "processing" && (
            <span className="bg-amber-50 text-amber-800">Processing…</span>
          )}
          {badge === "error" && (
            <button
              type="button"
              className="text-red-600 underline"
              onClick={async () => {
                setBadge("loading");
                try {
                  await getWasmBridge().recover();
                  setBadge("ready");
                } catch {
                  setBadge("error");
                }
              }}
            >
              Engine error — click to restart
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onShare()}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          Share settings
        </button>
      </div>

      {shareToast && (
        <p className="text-sm text-neutral-600" role="status" aria-live="polite">
          {shareToast}
        </p>
      )}

      <DropZone
        items={rows}
        multiple={op === "merge" || op === "compress"}
        onItemsChange={(next) =>
          setRows(next.map((r) => ({ ...r, pageCount: undefined })))
        }
        hint={limitsHint}
      />

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">Files</h2>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-red-600 hover:underline"
            >
              Clear all
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={rows.filter((r) => !r.error).map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <SortRow
                    key={r.id}
                    row={r}
                    canDrag={op === "merge" || op === "compress"}
                    onRemove={() => removeRow(r.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div role="tablist" aria-label="PDF operation" className="flex flex-wrap gap-2">
        {OPS.map(({ id, label }) => {
          const disabled = tabDisabled(id);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={op === id}
              aria-disabled={disabled}
              disabled={disabled}
              title={disabled ? "Requires exactly 1 file" : undefined}
              onClick={() => selectOperation(id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                op === id
                  ? "bg-neutral-900 text-white"
                  : disabled
                    ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5 space-y-4">
        {op === "merge" && (
          <label className="block text-sm text-neutral-700">
            Output filename
            <input
              className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
              value={mergeOut}
              onChange={(e) => setMergeOut(e.target.value)}
            />
          </label>
        )}

        {op === "split" && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" checked={splitMode === "range"} onChange={() => setSplitMode("range")} />
                By page range
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={splitMode === "every"} onChange={() => setSplitMode("every")} />
                Every N pages
              </label>
            </div>
            {splitMode === "range" ? (
              <input
                aria-label="Page range"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
                placeholder="1-3, 5, 7-9"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
              />
            ) : (
              <input
                aria-label="Pages per split"
                type="number"
                min={1}
                className="w-32 rounded-lg border border-neutral-300 bg-white px-3 py-2"
                value={splitEvery}
                onChange={(e) => setSplitEvery(parseInt(e.target.value || "1", 10))}
              />
            )}
          </div>
        )}

        {op === "compress" && (
          <div className="flex gap-4 text-sm">
            {(["low", "medium", "high"] as const).map((q) => (
              <label key={q} className="flex items-center gap-2 capitalize">
                <input type="radio" checked={compressQ === q} onChange={() => setCompressQ(q)} />
                {q}
              </label>
            ))}
          </div>
        )}

        {op === "rotate" && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              {([90, 180, 270] as const).map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input type="radio" checked={rotAngle === a} onChange={() => setRotAngle(a)} />
                  {a}°
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rotAll} onChange={(e) => setRotAll(e.target.checked)} />
              All pages
            </label>
            {!rotAll && (
              <input
                aria-label="Page range to rotate"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
                placeholder="1-2, 4"
                value={rotPages}
                onChange={(e) => setRotPages(e.target.value)}
              />
            )}
          </div>
        )}

        {op === "watermark" && (
          <div className="space-y-3 text-sm">
            <label className="block">
              Watermark text
              <input
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
                value={wmText}
                maxLength={200}
                onChange={(e) => setWmText(e.target.value)}
              />
            </label>
            <label className="block">
              Position
              <select
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
                value={wmPos}
                onChange={(e) => setWmPos(e.target.value as typeof wmPos)}
              >
                <option value="center">Centre</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
              </select>
            </label>
            <label className="block">
              Opacity {wmOpacity}%
              <input type="range" min={0} max={100} value={wmOpacity}
                onChange={(e) => setWmOpacity(parseInt(e.target.value, 10))} className="w-full" />
            </label>
            <label className="block">
              Font size {wmSize} pt
              <input type="range" min={12} max={120} value={wmSize}
                onChange={(e) => setWmSize(parseInt(e.target.value, 10))} className="w-full" />
            </label>
            <label className="block">
              Colour
              <input type="color" value={wmColor} onChange={(e) => setWmColor(e.target.value)}
                className="mt-1.5 h-9 w-full rounded border border-neutral-300" />
            </label>
            <label className="block">
              Text rotation {wmRot}°
              <input type="range" min={0} max={90} value={wmRot}
                onChange={(e) => setWmRot(parseInt(e.target.value, 10))} className="w-full" />
            </label>
          </div>
        )}

        {validationError && (
          <p className="text-sm text-amber-700" role="alert">{validationError}</p>
        )}

        <button
          type="button"
          disabled={!canRun}
          onClick={() => void onRun()}
          className="w-full rounded-lg bg-neutral-900 py-3 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {op === "merge" ? "Merge PDFs" :
           op === "split" ? "Split PDF" :
           op === "compress" ? "Compress PDF" :
           op === "rotate" ? "Rotate PDF" : "Add watermark"}
        </button>
      </div>

      <div
        className="rounded-xl border border-neutral-200 bg-white p-5 min-h-[100px]"
        aria-live="polite"
      >
        {outPhase === "idle" && (
          <p className="text-sm text-neutral-400">Results will appear here</p>
        )}
        {outPhase === "processing" && (
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
            Processing… {elapsed}s
          </div>
        )}
        {(outPhase === "success" || outPhase === "error" || outPhase === "timeout") && (
          <div className="space-y-3">
            <p className={`text-sm ${outPhase === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {outMsg}
            </p>
            {outPhase === "success" && pendingDownload && (
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onClick={() => triggerDownload(pendingDownload.data, pendingDownload.mime, pendingDownload.filename)}
              >
                Download {pendingDownload.filename}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortRow({
  row,
  canDrag,
  onRemove,
}: {
  row: QueueRow;
  canDrag: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id, disabled: !canDrag || !!row.error });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        row.error ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
      }`}
    >
      {canDrag && !row.error && (
        <button type="button" className="cursor-grab text-neutral-400" {...attributes} {...listeners}
          aria-label={`Drag to reorder ${row.file.name}`}>⋮⋮</button>
      )}
      <span className="flex-1 truncate" title={row.file.name}>{truncName(row.file.name)}</span>
      <span className="text-neutral-400">{fmtSize(row.file.size)}</span>
      <span className="w-12 text-right tabular-nums text-neutral-400">
        {row.error ? "—" : row.pageCount === undefined ? "…" : row.pageCount < 0 ? "—" : row.pageCount}
      </span>
      {row.error && <span className="max-w-[160px] truncate text-xs text-red-600">{row.error}</span>}
      <button type="button" onClick={onRemove} className="text-neutral-400 hover:text-red-600"
        aria-label={`Remove ${row.file.name}`}>×</button>
    </li>
  );
}
