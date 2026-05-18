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
  /** undefined = not loaded yet; -1 = unknown */
  pageCount?: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncName(name: string, max = 40): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

interface PendingDownload {
  data: Uint8Array;
  mime: string;
  filename: string;
}

export function PressWorkspace() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [op, setOp] = useState<OperationId>("merge");
  const [badge, setBadge] = useState<EngineBadge>("loading");

  const [mergeOut, setMergeOut] = useState("merged.pdf");
  const [splitMode, setSplitMode] = useState<"range" | "every">("range");
  const [splitRange, setSplitRange] = useState("");
  const [splitEvery, setSplitEvery] = useState(1);
  const [compressQ, setCompressQ] = useState<"low" | "medium" | "high">(
    "medium",
  );
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
  const [shareToast, setShareToast] = useState(false);
  const [pendingDownload, setPendingDownload] =
    useState<PendingDownload | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const valids = useMemo(() => rows.filter((r) => !r.error), [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
    (async () => {
      try {
        await getWasmBridge().ensureReady();
        if (live) setBadge("ready");
      } catch {
        if (live) {
          setBadge("error");
        }
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
    return !!hash;
  }, [
    op,
    mergeOut,
    splitMode,
    splitRange,
    splitEvery,
    compressQ,
    rotAngle,
    rotAll,
    rotPages,
    wmText,
    wmPos,
    wmOpacity,
    wmSize,
    wmColor,
    wmRot,
  ]);

  const onShare = useCallback(async () => {
    if (!syncUrl()) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* */
    }
    setShareToast(true);
    window.setTimeout(() => setShareToast(false), 3500);
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
        if (typeof pc === "number" && pc > 0 && pageRangeExceedsDocument(splitRange, pc))
          return MSG.splitRangeExceeds(pc);
      } else {
        if (splitEvery < 1) return MSG.splitNInvalid;
        if (typeof pc === "number" && pc > 0 && splitEvery >= pc)
          return MSG.splitRangeExceeds(pc);
      }
    }
    if (op === "rotate" && !rotAll) {
      if (!rotPages.trim() || !isValidPageRangeSyntax(rotPages))
        return MSG.splitRangeInvalid;
      const pc = valids[0]?.pageCount;
      if (typeof pc === "number" && pc > 0 && pageRangeExceedsDocument(rotPages, pc))
        return MSG.splitRangeExceeds(pc);
    }
    if (op === "watermark") {
      if (!wmText.trim()) return MSG.wmEmpty;
      if (wmText.length > 200) return MSG.wmLong;
    }
    return null;
  }, [valids, op, splitMode, splitRange, splitEvery, rotAll, rotPages, wmText]);

  const canRun =
    badge === "ready" && validationError === null && outPhase !== "processing";

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const clearAll = () => setRows([]);

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
      const moved = arrayMove(val, oldIdx, newIdx);
      return [...err, ...moved];
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
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setBadge("ready");
  };

  const selectOperation = (id: OperationId) => {
    switch (id) {
      case "merge":
        setMergeOut("merged.pdf");
        break;
      case "split":
        setSplitMode("range");
        setSplitRange("");
        setSplitEvery(1);
        break;
      case "compress":
        setCompressQ("medium");
        break;
      case "rotate":
        setRotAngle(90);
        setRotAll(true);
        setRotPages("");
        break;
      case "watermark":
        setWmText("CONFIDENTIAL");
        setWmPos("center");
        setWmOpacity(30);
        setWmSize(48);
        setWmColor("#808080");
        setWmRot(45);
        break;
    }
    setOp(id);
    setOutPhase("idle");
    setOutMsg("");
    setPendingDownload(null);
  };

  const onRun = async () => {
    if (badge === "loading") {
      setOutPhase("error");
      setOutMsg(PRD.engineLoading);
      return;
    }
    if (badge !== "ready") {
      setOutPhase("error");
      setOutMsg(PRD.engineRestarted);
      return;
    }
    if (!canRun || validationError) return;
    const bridge = getWasmBridge();
    setPendingDownload(null);
    startProcessing();
    try {
      if (op === "merge") {
        const buffers = await Promise.all(
          valids.map((v) => readFileArrayBuffer(v.file)),
        );
        const res = await bridge.run(
          "merge",
          buffers.map((b) => b.slice(0)),
          { configJson: JSON.stringify({ dividerPage: false }) },
          { transfer: false },
        );
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        const filename = sanitizeFilename(mergeOut || "merged.pdf");
        const mb = (res.buffer.byteLength / (1024 * 1024)).toFixed(1);
        setPendingDownload({
          data: new Uint8Array(res.buffer),
          mime: "application/pdf",
          filename,
        });
        setOutPhase("success");
        setOutMsg(`Merged ${valids.length} files · ${mb} MB`);
      } else if (op === "split") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const cfg =
          splitMode === "range"
            ? JSON.stringify({ pages: splitRange.trim(), span: 0 })
            : JSON.stringify({ span: splitEvery, pages: "" });
        const res = await bridge.run("split", [buf], { configJson: cfg });
        const parts = res.buffers || [];
        const meta = res.splitMeta || [];
        if (parts.length === 1) {
          setPendingDownload({
            data: new Uint8Array(parts[0]),
            mime: "application/pdf",
            filename: "split-1.pdf",
          });
        } else {
          const entries = parts.map((b, i) => ({
            name: `split-${meta[i]?.from ?? i + 1}-${meta[i]?.thru ?? i + 1}.pdf`,
            data: new Uint8Array(b),
          }));
          const zip = buildZip(entries);
          setPendingDownload({
            data: zip,
            mime: "application/zip",
            filename: "split-output.zip",
          });
        }
        setOutPhase("success");
        setOutMsg(`Split into ${parts.length} file(s)`);
      } else if (op === "compress") {
        const buffers = await Promise.all(
          valids.map((v) => readFileArrayBuffer(v.file)),
        );
        const res = await bridge.run(
          "optimize",
          buffers.map((b) => b.slice(0)),
          { quality: compressQ },
          { transfer: false },
        );
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
          setOutMsg(
            pct > 0
              ? `Compressed to ${fmtSize(comp)} (${pct}% smaller than ${fmtSize(orig)})`
              : `Compressed to ${fmtSize(comp)} (size unchanged)`,
          );
        } else {
          const entries = outs.map((b, i) => ({
            name: sanitizeFilename(
              valids[i].file.name.replace(/\.pdf$/i, "") + "-compressed.pdf",
            ),
            data: new Uint8Array(b),
          }));
          const zip = buildZip(entries);
          setPendingDownload({
            data: zip,
            mime: "application/zip",
            filename: "compressed.zip",
          });
          setOutPhase("success");
          setOutMsg(`Compressed ${outs.length} files — download zip`);
        }
      } else if (op === "rotate") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const cfg = JSON.stringify({
          rotation: rotAngle,
          pages: rotAll ? "" : rotPages.trim(),
        });
        const res = await bridge.run("rotate", [buf], { configJson: cfg });
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
        const cfg = JSON.stringify({
          text: wmText,
          opacity: String(wmOpacity / 100),
          rotation: String(wmRot),
          onTop: true,
          position: wmPos,
          fontSize: wmSize,
          color: wmColor,
        });
        const res = await bridge.run("watermark", [buf], { configJson: cfg });
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        setPendingDownload({
          data: new Uint8Array(res.buffer),
          mime: "application/pdf",
          filename: "watermarked.pdf",
        });
        setOutPhase("success");
        setOutMsg("Watermarked PDF ready");
      }
      stopProcessing();
    } catch (e) {
      stopProcessing();
      if (e instanceof PdfEngineError) {
        if (e.code === "timeout") {
          setOutPhase("timeout");
          setOutMsg(PRD.timeout);
        } else {
          setOutPhase("error");
          setOutMsg(e.message || PRD.genericWasm);
        }
      } else {
        setOutPhase("error");
        setOutMsg(PRD.genericWasm);
      }
    }
  };

  const tabDisabled = (id: OperationId) => {
    if (id !== "split" && id !== "rotate" && id !== "watermark") return false;
    return valids.length !== 1;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Press</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Browser-native PDF tools — powered by WebAssembly (pdfcpu)
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3 max-w-xl">
            Your files never leave your browser. All PDF processing happens
            locally using WebAssembly. Nothing is uploaded to any server.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onShare}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Share settings
          </button>
          {shareToast && (
            <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs text-right">
              Link copied. Note: your files are not included in the link.
            </p>
          )}
          <div
            className={`text-xs px-2 py-1 rounded ${
              badge === "ready"
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : badge === "processing"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                  : badge === "loading"
                    ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {badge === "loading" && "Loading engine…"}
            {badge === "ready" && "Ready"}
            {badge === "processing" && "Processing"}
            {badge === "error" && (
              <button
                type="button"
                className="underline"
                onClick={async () => {
                  setBadge("loading");
                  await getWasmBridge().recover();
                  setBadge("ready");
                }}
              >
                Error — click to restart
              </button>
            )}
          </div>
        </div>
      </div>

      <DropZone
        items={rows}
        multiple={op === "merge" || op === "compress"}
        onItemsChange={(next) =>
          setRows(next.map((r) => ({ ...r, pageCount: undefined })))
        }
      />

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Files</h2>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-red-600 hover:underline"
            >
              Clear all
            </button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rows.filter((r) => !r.error).map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
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

      <div>
        <h2 className="text-lg font-semibold mb-2">Operation</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "merge",
              "split",
              "compress",
              "rotate",
              "watermark",
            ] as OperationId[]
          ).map((id) => (
            <button
              key={id}
              type="button"
              title={tabDisabled(id) ? "Requires exactly 1 file" : undefined}
              disabled={false}
              onClick={() => selectOperation(id)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize border ${
                op === id
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50"
                  : tabDisabled(id)
                    ? "opacity-45 border-gray-200 dark:border-gray-700"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {id === "compress" ? "Compress" : id}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-white/50 dark:bg-gray-900/30">
        {op === "merge" && (
          <label className="block text-sm">
            Output filename (optional)
            <input
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-900"
              value={mergeOut}
              onChange={(e) => setMergeOut(e.target.value)}
            />
          </label>
        )}
        {op === "split" && (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={splitMode === "range"}
                  onChange={() => setSplitMode("range")}
                />
                By page range
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={splitMode === "every"}
                  onChange={() => setSplitMode("every")}
                />
                Every N pages
              </label>
            </div>

            {splitMode === "range" ? (
              <input
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1"
                placeholder="1-3, 5, 7-9"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
              />
            ) : (
              <input
                type="number"
                min={1}
                className="w-32 rounded border border-gray-300 dark:border-gray-600 px-2 py-1"
                value={splitEvery}
                onChange={(e) =>
                  setSplitEvery(parseInt(e.target.value || "1", 10))
                }
              />
            )}
          </div>
        )}

        {op === "compress" && (
          <div className="flex gap-4 text-sm">
            {(["low", "medium", "high"] as const).map((q) => (
              <label key={q} className="flex items-center gap-2 capitalize">
                <input
                  type="radio"
                  checked={compressQ === q}
                  onChange={() => setCompressQ(q)}
                />

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
                  <input
                    type="radio"
                    checked={rotAngle === a}
                    onChange={() => setRotAngle(a)}
                  />
                  {a}°
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rotAll}
                onChange={(e) => setRotAll(e.target.checked)}
              />
              All pages
            </label>

            {!rotAll && (
              <input
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1"
                placeholder="Page range: 1-2, 4"
                value={rotPages}
                onChange={(e) => setRotPages(e.target.value)}
              />
            )}
          </div>
        )}

        {op === "watermark" && (
          <div className="space-y-3 text-sm">
            <input
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1"
              value={wmText}
              maxLength={200}
              onChange={(e) => setWmText(e.target.value)}
            />

            <label className="block">
              Position
              <select
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1"
                value={wmPos}
                onChange={(e) => setWmPos(e.target.value as typeof wmPos)}
              >
                <option value="center">centre</option>

                <option value="top-left">top-left</option>

                <option value="top-right">top-right</option>

                <option value="bottom-left">bottom-left</option>

                <option value="bottom-right">bottom-right</option>
              </select>
            </label>

            <label className="block">
              Opacity {wmOpacity}%
              <input
                type="range"
                min={0}
                max={100}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </label>

            <label className="block">
              Font size {wmSize} pt
              <input
                type="range"
                min={12}
                max={120}
                value={wmSize}
                onChange={(e) => setWmSize(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </label>

            <label className="block">
              Colour
              <input
                type="color"
                value={wmColor}
                onChange={(e) => setWmColor(e.target.value)}
                className="mt-1 h-8 w-full rounded border border-gray-300"
              />
            </label>

            <label className="block">
              Text rotation {wmRot}°
              <input
                type="range"
                min={0}
                max={90}
                value={wmRot}
                onChange={(e) => setWmRot(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </label>
          </div>
        )}

        {validationError && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {validationError}
          </p>
        )}

        <button
          type="button"
          disabled={!canRun}
          onClick={() => void onRun()}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Run
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 min-h-[120px] bg-gray-50/80 dark:bg-gray-900/50">
        {outPhase === "idle" && (
          <p className="text-sm text-gray-500">
            Configure an operation and click Run
          </p>
        )}

        {outPhase === "processing" && (
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />

            <span>Processing… {elapsed}s</span>
          </div>
        )}

        {(outPhase === "success" ||
          outPhase === "error" ||
          outPhase === "timeout") && (
          <div className="space-y-3">
            <p
              className={`text-sm ${
                outPhase === "success"
                  ? "text-green-800 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {outMsg}
            </p>
            {outPhase === "success" && pendingDownload && (
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800"
                onClick={() => {
                  triggerDownload(
                    pendingDownload.data,
                    pendingDownload.mime,
                    pendingDownload.filename,
                  );
                }}
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

  const style = {
    transform: CSS.Transform.toString(transform),

    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
        row.error
          ? "border-red-300 bg-red-50 dark:bg-red-950/30"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      }`}
    >
      {canDrag && !row.error && (
        <button
          type="button"
          className="cursor-grab text-gray-400"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>
      )}

      <span className="flex-1 truncate" title={row.file.name}>
        {truncName(row.file.name)}
      </span>

      <span className="text-gray-500">{fmtSize(row.file.size)}</span>

      <span className="text-gray-500 w-16 text-right tabular-nums">
        {row.error
          ? "—"
          : row.pageCount === undefined
            ? "…"
            : row.pageCount < 0
              ? "—"
              : row.pageCount}
      </span>

      {row.warn && !row.error && (
        <span className="text-xs text-amber-600 max-w-[140px] truncate" title={MSG.largeWarn}>
          {MSG.largeWarn}
        </span>
      )}

      {row.error && (
        <span className="text-xs text-red-600 max-w-[200px] truncate">
          {row.error}
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 px-1"
        aria-label="Remove"
      >
        ×
      </button>
    </li>
  );
}
