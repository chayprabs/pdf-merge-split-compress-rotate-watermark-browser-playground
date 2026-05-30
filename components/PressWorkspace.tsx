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
  validatePdfBuffer,
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
import type { OperationId, ShareableState, SplitMode } from "@/lib/shareState";
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
  { id: "metadata", label: "Metadata" },
];

const ACTION_LABELS: Record<OperationId, string> = {
  merge: "Merge PDFs",
  split: "Split PDF",
  compress: "Compress PDF",
  rotate: "Rotate PDF",
  watermark: "Watermark PDF",
  metadata: "Update Metadata",
};

const COMPRESS_QUALITY: {
  id: "low" | "medium" | "high";
  label: string;
  description: string;
}[] = [
  {
    id: "low",
    label: "Low",
    description: "Light cleanup — fastest, modest size reduction",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balanced — recommended for most files",
  },
  {
    id: "high",
    label: "High",
    description: "Aggressive — best compression, slower",
  },
];

const SINGLE_FILE_OPS: OperationId[] = [
  "split",
  "rotate",
  "watermark",
  "metadata",
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncName(name: string, max = 40): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function defaultOutputName(op: OperationId): string {
  switch (op) {
    case "merge":
      return "merged.pdf";
    case "split":
      return "split.pdf";
    case "compress":
      return "compressed.pdf";
    case "rotate":
      return "rotated.pdf";
    case "watermark":
      return "watermarked.pdf";
    case "metadata":
      return "metadata.pdf";
  }
}

export function PressWorkspace() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [op, setOp] = useState<OperationId>("merge");
  const [badge, setBadge] = useState<EngineBadge>("loading");

  const [mergeOut, setMergeOut] = useState("merged.pdf");
  const [mergeDivider, setMergeDivider] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>("range");
  const [splitRange, setSplitRange] = useState("");
  const [splitEvery, setSplitEvery] = useState(1);
  const [splitExtractPages, setSplitExtractPages] = useState("");
  const [splitRemovePages, setSplitRemovePages] = useState("");
  const [splitOut, setSplitOut] = useState("split.pdf");
  const [compressQ, setCompressQ] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [compressOut, setCompressOut] = useState("compressed.pdf");
  const [rotAngle, setRotAngle] = useState<90 | 180 | 270>(90);
  const [rotAll, setRotAll] = useState(true);
  const [rotPages, setRotPages] = useState("");
  const [rotateOut, setRotateOut] = useState("rotated.pdf");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmPos, setWmPos] = useState<
    "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  >("center");
  const [wmOpacity, setWmOpacity] = useState(30);
  const [wmSize, setWmSize] = useState(48);
  const [wmColor, setWmColor] = useState("#808080");
  const [wmRot, setWmRot] = useState(45);
  const [wmAllPages, setWmAllPages] = useState(true);
  const [wmPages, setWmPages] = useState("");
  const [wmOnTop, setWmOnTop] = useState(true);
  const [wmOut, setWmOut] = useState("watermarked.pdf");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaAuthor, setMetaAuthor] = useState("");
  const [metaSubject, setMetaSubject] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [metaCreator, setMetaCreator] = useState("");
  const [metaOut, setMetaOut] = useState("metadata.pdf");

  const [outPhase, setOutPhase] = useState<
    "idle" | "processing" | "success" | "error" | "timeout"
  >("idle");
  const [outMsg, setOutMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [shareToast, setShareToast] = useState(false);
  const [pendingDownload, setPendingDownload] =
    useState<PendingDownload | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);

  const valids = useMemo(() => rows.filter((r) => !r.error), [rows]);
  const engineVersion = getWasmBridge().engineVersion;

  const limitsHint = useMemo(
    () =>
      `Up to ${fmtSize(MAX_FILE_BYTES)} per file, ${fmtSize(MAX_TOTAL_BYTES)} total`,
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const resetOutput = useCallback(() => {
    setOutPhase("idle");
    setOutMsg("");
    setPendingDownload(null);
  }, []);

  useEffect(() => {
    const decoded = decodeStateFromHash();
    if (!decoded) return;
    if (decoded.operation) setOp(decoded.operation);
    if (decoded.mergeOutputName) setMergeOut(decoded.mergeOutputName);
    if (decoded.mergeDividerPage != null)
      setMergeDivider(decoded.mergeDividerPage);
    if (decoded.splitMode) setSplitMode(decoded.splitMode);
    if (decoded.splitRange != null) setSplitRange(decoded.splitRange);
    if (decoded.splitEveryN != null) setSplitEvery(decoded.splitEveryN);
    if (decoded.splitExtractPages != null)
      setSplitExtractPages(decoded.splitExtractPages);
    if (decoded.splitRemovePages != null)
      setSplitRemovePages(decoded.splitRemovePages);
    if (decoded.splitOutputName) setSplitOut(decoded.splitOutputName);
    if (decoded.compressQuality) setCompressQ(decoded.compressQuality);
    if (decoded.compressOutputName) setCompressOut(decoded.compressOutputName);
    if (decoded.rotateAngle) setRotAngle(decoded.rotateAngle);
    if (decoded.rotateAllPages != null) setRotAll(decoded.rotateAllPages);
    if (decoded.rotatePages != null) setRotPages(decoded.rotatePages);
    if (decoded.rotateOutputName) setRotateOut(decoded.rotateOutputName);
    if (decoded.wmText != null) setWmText(decoded.wmText);
    if (decoded.wmPosition) setWmPos(decoded.wmPosition);
    if (decoded.wmOpacityPct != null) setWmOpacity(decoded.wmOpacityPct);
    if (decoded.wmFontSize != null) setWmSize(decoded.wmFontSize);
    if (decoded.wmColor) setWmColor(decoded.wmColor);
    if (decoded.wmRotation != null) setWmRot(decoded.wmRotation);
    if (decoded.wmAllPages != null) setWmAllPages(decoded.wmAllPages);
    if (decoded.wmPages != null) setWmPages(decoded.wmPages);
    if (decoded.wmOnTop != null) setWmOnTop(decoded.wmOnTop);
    if (decoded.wmOutputName) setWmOut(decoded.wmOutputName);
    if (decoded.metaTitle != null) setMetaTitle(decoded.metaTitle);
    if (decoded.metaAuthor != null) setMetaAuthor(decoded.metaAuthor);
    if (decoded.metaSubject != null) setMetaSubject(decoded.metaSubject);
    if (decoded.metaKeywords != null) setMetaKeywords(decoded.metaKeywords);
    if (decoded.metaCreator != null) setMetaCreator(decoded.metaCreator);
    if (decoded.metaOutputName) setMetaOut(decoded.metaOutputName);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
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
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
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
            const validation = await validatePdfBuffer(buf);
            if (cancelled) return;
            if (!validation.valid) {
              setRows((prev) =>
                prev.map((x) =>
                  x.id === id
                    ? {
                        ...x,
                        pageCount: -1,
                        error: validation.error ?? PRD.genericWasm,
                      }
                    : x,
                ),
              );
              continue;
            }
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
      mergeDividerPage: mergeDivider,
      splitMode,
      splitRange,
      splitEveryN: splitEvery,
      splitExtractPages,
      splitRemovePages,
      splitOutputName: splitOut,
      compressQuality: compressQ,
      compressOutputName: compressOut,
      rotateAngle: rotAngle,
      rotateAllPages: rotAll,
      rotatePages: rotPages,
      rotateOutputName: rotateOut,
      wmText,
      wmPosition: wmPos,
      wmOpacityPct: wmOpacity,
      wmFontSize: wmSize,
      wmColor,
      wmRotation: wmRot,
      wmAllPages,
      wmPages,
      wmOnTop,
      wmOutputName: wmOut,
      metaTitle,
      metaAuthor,
      metaSubject,
      metaKeywords,
      metaCreator,
      metaOutputName: metaOut,
    };
    const hash = encodeState(state);
    if (hash) applyHashToLocation(hash);
    return !!hash;
  }, [
    op,
    mergeOut,
    mergeDivider,
    splitMode,
    splitRange,
    splitEvery,
    splitExtractPages,
    splitRemovePages,
    splitOut,
    compressQ,
    compressOut,
    rotAngle,
    rotAll,
    rotPages,
    rotateOut,
    wmText,
    wmPos,
    wmOpacity,
    wmSize,
    wmColor,
    wmRot,
    wmAllPages,
    wmPages,
    wmOnTop,
    wmOut,
    metaTitle,
    metaAuthor,
    metaSubject,
    metaKeywords,
    metaCreator,
    metaOut,
  ]);

  const onShare = useCallback(async () => {
    if (!syncUrl()) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setShareToast(true);
    window.setTimeout(() => setShareToast(false), 3500);
  }, [syncUrl]);

  const pageRangeForSplit = useMemo(() => {
    if (splitMode === "range") return splitRange;
    if (splitMode === "extract") return splitExtractPages;
    if (splitMode === "remove") return splitRemovePages;
    return "";
  }, [splitMode, splitRange, splitExtractPages, splitRemovePages]);

  const validationError = useMemo(() => {
    if (valids.length === 0) return MSG.emptyOnRun;
    if (op === "merge") {
      if (valids.length < 2) return MSG.mergeMin;
      if (valids.length > 20) return MSG.mergeMax;
    }
    if (SINGLE_FILE_OPS.includes(op)) {
      if (valids.length !== 1) {
        if (op === "split") return MSG.splitOne;
        if (op === "rotate") return MSG.rotateOne;
        if (op === "watermark") return MSG.wmOne;
        return MSG.metadataOne;
      }
    }
    if (op === "compress" && valids.length > 10) return MSG.compressMax;

    const pc = valids[0]?.pageCount;

    if (op === "split") {
      if (splitMode === "range" || splitMode === "extract" || splitMode === "remove") {
        const range = pageRangeForSplit;
        if (!range.trim()) return MSG.splitRangeInvalid;
        if (!isValidPageRangeSyntax(range)) return MSG.splitRangeInvalid;
        if (typeof pc === "number" && pc > 0 && pageRangeExceedsDocument(range, pc))
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
      if (typeof pc === "number" && pc > 0 && pageRangeExceedsDocument(rotPages, pc))
        return MSG.splitRangeExceeds(pc);
    }

    if (op === "watermark") {
      if (!wmText.trim()) return MSG.wmEmpty;
      if (wmText.length > 200) return MSG.wmLong;
      if (!wmAllPages) {
        if (!wmPages.trim() || !isValidPageRangeSyntax(wmPages))
          return MSG.splitRangeInvalid;
        if (typeof pc === "number" && pc > 0 && pageRangeExceedsDocument(wmPages, pc))
          return MSG.splitRangeExceeds(pc);
      }
    }

    if (op === "metadata") {
      const hasField =
        metaTitle.trim() ||
        metaAuthor.trim() ||
        metaSubject.trim() ||
        metaKeywords.trim() ||
        metaCreator.trim();
      if (!hasField) return MSG.metadataEmpty;
    }

    return null;
  }, [
    valids,
    op,
    splitMode,
    pageRangeForSplit,
    splitEvery,
    rotAll,
    rotPages,
    wmText,
    wmAllPages,
    wmPages,
    metaTitle,
    metaAuthor,
    metaSubject,
    metaKeywords,
    metaCreator,
  ]);

  const canRun =
    badge === "ready" && validationError === null && outPhase !== "processing";

  const tabDisabled = (id: OperationId) =>
    SINGLE_FILE_OPS.includes(id) && valids.length !== 1;

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

  const finishSuccess = (
    runId: number,
    download: PendingDownload,
    message: string,
  ) => {
    if (runId !== runIdRef.current) return;
    triggerDownload(download.data, download.mime, download.filename);
    setPendingDownload(download);
    setOutPhase("success");
    setOutMsg(message);
  };

  const selectOperation = (id: OperationId) => {
    runIdRef.current += 1;
    resetOutput();
    switch (id) {
      case "merge":
        setMergeOut(defaultOutputName("merge"));
        setMergeDivider(false);
        break;
      case "split":
        setSplitMode("range");
        setSplitRange("");
        setSplitEvery(1);
        setSplitExtractPages("");
        setSplitRemovePages("");
        setSplitOut(defaultOutputName("split"));
        break;
      case "compress":
        setCompressQ("medium");
        setCompressOut(defaultOutputName("compress"));
        break;
      case "rotate":
        setRotAngle(90);
        setRotAll(true);
        setRotPages("");
        setRotateOut(defaultOutputName("rotate"));
        break;
      case "watermark":
        setWmText("CONFIDENTIAL");
        setWmPos("center");
        setWmOpacity(30);
        setWmSize(48);
        setWmColor("#808080");
        setWmRot(45);
        setWmAllPages(true);
        setWmPages("");
        setWmOnTop(true);
        setWmOut(defaultOutputName("watermark"));
        break;
      case "metadata":
        setMetaTitle("");
        setMetaAuthor("");
        setMetaSubject("");
        setMetaKeywords("");
        setMetaCreator("");
        setMetaOut(defaultOutputName("metadata"));
        break;
    }
    setOp(id);
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

    const runId = ++runIdRef.current;
    const bridge = getWasmBridge();
    resetOutput();
    startProcessing();

    try {
      if (op === "merge") {
        const buffers = await Promise.all(
          valids.map((v) => readFileArrayBuffer(v.file)),
        );
        const res = await bridge.run(
          "merge",
          buffers.map((b) => b.slice(0)),
          {
            configJson: JSON.stringify({ dividerPage: mergeDivider }),
          },
          { transfer: false },
        );
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        const filename = sanitizeFilename(mergeOut || "merged.pdf");
        const mb = (res.buffer.byteLength / (1024 * 1024)).toFixed(1);
        finishSuccess(
          runId,
          {
            data: new Uint8Array(res.buffer),
            mime: "application/pdf",
            filename,
          },
          `Merged ${valids.length} files · ${mb} MB`,
        );
      } else if (op === "split") {
        const buf = await readFileArrayBuffer(valids[0].file);
        if (splitMode === "extract") {
          const cfg = JSON.stringify({
            pages: splitExtractPages.trim(),
          });
          const res = await bridge.run("extractPages", [buf], {
            configJson: cfg,
          });
          if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
          const filename = sanitizeFilename(splitOut || "split.pdf");
          finishSuccess(
            runId,
            {
              data: new Uint8Array(res.buffer),
              mime: "application/pdf",
              filename,
            },
            "Extracted pages ready",
          );
        } else if (splitMode === "remove") {
          const cfg = JSON.stringify({
            pages: splitRemovePages.trim(),
          });
          const res = await bridge.run("removePages", [buf], {
            configJson: cfg,
          });
          if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
          const filename = sanitizeFilename(splitOut || "split.pdf");
          finishSuccess(
            runId,
            {
              data: new Uint8Array(res.buffer),
              mime: "application/pdf",
              filename,
            },
            "Removed pages — PDF ready",
          );
        } else {
          const cfg =
            splitMode === "range"
              ? JSON.stringify({ pages: splitRange.trim(), span: 0 })
              : JSON.stringify({ span: splitEvery, pages: "" });
          const res = await bridge.run("split", [buf], { configJson: cfg });
          const parts = res.buffers || [];
          const meta = res.splitMeta || [];
          if (parts.length === 1) {
            const filename = sanitizeFilename(splitOut || "split-1.pdf");
            finishSuccess(
              runId,
              {
                data: new Uint8Array(parts[0]),
                mime: "application/pdf",
                filename,
              },
              "Split into 1 file",
            );
          } else {
            const entries = parts.map((b, i) => ({
              name: `split-${meta[i]?.from ?? i + 1}-${meta[i]?.thru ?? i + 1}.pdf`,
              data: new Uint8Array(b),
            }));
            const zip = buildZip(entries);
            finishSuccess(
              runId,
              {
                data: zip,
                mime: "application/zip",
                filename: "split-output.zip",
              },
              `Split into ${parts.length} file(s)`,
            );
          }
        }
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
          const filename = sanitizeFilename(compressOut || "compressed.pdf");
          finishSuccess(
            runId,
            {
              data: new Uint8Array(outs[0]),
              mime: "application/pdf",
              filename,
            },
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
          finishSuccess(
            runId,
            {
              data: zip,
              mime: "application/zip",
              filename: "compressed.zip",
            },
            `Compressed ${outs.length} files — download zip`,
          );
        }
      } else if (op === "rotate") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const cfg = JSON.stringify({
          rotation: rotAngle,
          pages: rotAll ? "" : rotPages.trim(),
        });
        const res = await bridge.run("rotate", [buf], { configJson: cfg });
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        const filename = sanitizeFilename(rotateOut || "rotated.pdf");
        finishSuccess(
          runId,
          {
            data: new Uint8Array(res.buffer),
            mime: "application/pdf",
            filename,
          },
          "Rotated PDF ready",
        );
      } else if (op === "watermark") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const cfg = JSON.stringify({
          text: wmText,
          opacity: String(wmOpacity / 100),
          rotation: String(wmRot),
          onTop: wmOnTop,
          position: wmPos,
          fontSize: wmSize,
          color: wmColor,
          pages: wmAllPages ? "" : wmPages.trim(),
        });
        const res = await bridge.run("watermark", [buf], { configJson: cfg });
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        const filename = sanitizeFilename(wmOut || "watermarked.pdf");
        finishSuccess(
          runId,
          {
            data: new Uint8Array(res.buffer),
            mime: "application/pdf",
            filename,
          },
          "Watermarked PDF ready",
        );
      } else if (op === "metadata") {
        const buf = await readFileArrayBuffer(valids[0].file);
        const cfg = JSON.stringify({
          title: metaTitle.trim(),
          author: metaAuthor.trim(),
          subject: metaSubject.trim(),
          keywords: metaKeywords.trim(),
          creator: metaCreator.trim(),
        });
        const res = await bridge.run("setMetadata", [buf], { configJson: cfg });
        if (!res.buffer) throw new PdfEngineError(PRD.genericWasm);
        const filename = sanitizeFilename(metaOut || "metadata.pdf");
        finishSuccess(
          runId,
          {
            data: new Uint8Array(res.buffer),
            mime: "application/pdf",
            filename,
          },
          "Metadata updated",
        );
      }
      stopProcessing();
    } catch (e) {
      stopProcessing();
      if (runId !== runIdRef.current) return;
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Press
          </h1>
          <p className="text-neutral-600 mt-1">
            Browser-native PDF tools — powered by WebAssembly (pdfcpu)
          </p>
          <p className="text-sm text-emerald-700 mt-3 max-w-xl">
            Your files never leave your browser. All PDF processing happens
            locally using WebAssembly. Nothing is uploaded to any server.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onShare}
            className="text-sm px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700"
          >
            Share settings
          </button>
          {shareToast && (
            <p className="text-xs text-neutral-500 max-w-xs text-right">
              Link copied. Note: your files are not included in the link.
            </p>
          )}
          <div
            className={`text-xs px-2 py-1 rounded-lg ${
              badge === "ready"
                ? "bg-emerald-100 text-emerald-800"
                : badge === "processing"
                  ? "bg-amber-100 text-amber-900"
                  : badge === "loading"
                    ? "bg-neutral-100 text-neutral-700"
                    : "bg-red-100 text-red-800"
            }`}
          >
            {badge === "loading" && "Loading engine…"}
            {badge === "ready" && (
              <span>
                Ready · pdfcpu {engineVersion}
              </span>
            )}
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
        hint={limitsHint}
        onItemsChange={(next) =>
          setRows(next.map((r) => ({ ...r, pageCount: undefined })))
        }
      />

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-neutral-900">Files</h2>
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
        <h2 className="text-lg font-semibold mb-2 text-neutral-900">
          Operation
        </h2>
        <div className="flex flex-wrap gap-2">
          {OPS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              title={tabDisabled(id) ? "Requires exactly 1 file" : undefined}
              disabled={tabDisabled(id)}
              onClick={() => selectOperation(id)}
              className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                op === id
                  ? "border-neutral-900 bg-neutral-100 text-neutral-900 font-medium"
                  : tabDisabled(id)
                    ? "opacity-45 border-neutral-200 text-neutral-400 cursor-not-allowed"
                    : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 space-y-4 bg-white">
        {op === "merge" && (
          <div className="space-y-3">
            <label className="block text-sm text-neutral-700">
              Output filename
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900"
                value={mergeOut}
                onChange={(e) => setMergeOut(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={mergeDivider}
                onChange={(e) => setMergeDivider(e.target.checked)}
              />
              Insert blank divider page between each PDF
            </label>
          </div>
        )}

        {op === "split" && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 text-sm text-neutral-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "range"}
                  onChange={() => setSplitMode("range")}
                />
                By page range (multi-file)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "every"}
                  onChange={() => setSplitMode("every")}
                />
                Every N pages
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "extract"}
                  onChange={() => setSplitMode("extract")}
                />
                Extract pages (single PDF)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "remove"}
                  onChange={() => setSplitMode("remove")}
                />
                Remove pages
              </label>
            </div>

            {(splitMode === "range" ||
              splitMode === "extract" ||
              splitMode === "remove") && (
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900"
                placeholder="1-3, 5, 7-9"
                value={
                  splitMode === "range"
                    ? splitRange
                    : splitMode === "extract"
                      ? splitExtractPages
                      : splitRemovePages
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (splitMode === "range") setSplitRange(v);
                  else if (splitMode === "extract") setSplitExtractPages(v);
                  else setSplitRemovePages(v);
                }}
              />
            )}

            {splitMode === "every" && (
              <label className="block text-sm text-neutral-700">
                Pages per file
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-32 rounded-xl border border-neutral-300 px-3 py-2"
                  value={splitEvery}
                  onChange={(e) =>
                    setSplitEvery(parseInt(e.target.value || "1", 10))
                  }
                />
              </label>
            )}

            {(splitMode === "extract" || splitMode === "remove") && (
              <label className="block text-sm text-neutral-700">
                Output filename
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={splitOut}
                  onChange={(e) => setSplitOut(e.target.value)}
                />
              </label>
            )}
          </div>
        )}

        {op === "compress" && (
          <div className="space-y-3">
            <div className="space-y-2">
              {COMPRESS_QUALITY.map(({ id, label, description }) => (
                <label
                  key={id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 cursor-pointer ${
                    compressQ === id
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="compressQ"
                    checked={compressQ === id}
                    onChange={() => setCompressQ(id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-neutral-900">{label}</span>
                    <span className="block text-xs text-neutral-500">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {valids.length <= 1 && (
              <label className="block text-sm text-neutral-700">
                Output filename
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={compressOut}
                  onChange={(e) => setCompressOut(e.target.value)}
                />
              </label>
            )}
          </div>
        )}

        {op === "rotate" && (
          <div className="space-y-3 text-sm text-neutral-700">
            <div className="flex gap-3">
              {([90, 180, 270] as const).map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rotAngle"
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
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder="Page range: 1-2, 4"
                value={rotPages}
                onChange={(e) => setRotPages(e.target.value)}
              />
            )}

            <label className="block">
              Output filename
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={rotateOut}
                onChange={(e) => setRotateOut(e.target.value)}
              />
            </label>
          </div>
        )}

        {op === "watermark" && (
          <div className="space-y-3 text-sm text-neutral-700">
            <label className="block">
              Watermark text
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={wmText}
                maxLength={200}
                onChange={(e) => setWmText(e.target.value)}
              />
            </label>

            <label className="block">
              Position
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 bg-white"
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
                className="mt-1 h-8 w-full rounded-xl border border-neutral-300"
              />
            </label>

            <label className="block">
              Text rotation {wmRot}°
              <input
                type="range"
                min={0}
                max={360}
                value={wmRot}
                onChange={(e) => setWmRot(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={wmAllPages}
                onChange={(e) => setWmAllPages(e.target.checked)}
              />
              All pages
            </label>

            {!wmAllPages && (
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder="Page range: 1-2, 4"
                value={wmPages}
                onChange={(e) => setWmPages(e.target.value)}
              />
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={wmOnTop}
                onChange={(e) => setWmOnTop(e.target.checked)}
              />
              Place watermark on top (uncheck to place behind content)
            </label>

            <label className="block">
              Output filename
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={wmOut}
                onChange={(e) => setWmOut(e.target.value)}
              />
            </label>
          </div>
        )}

        {op === "metadata" && (
          <div className="space-y-3 text-sm text-neutral-700">
            <label className="block">
              Title
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
              />
            </label>
            <label className="block">
              Author
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={metaAuthor}
                onChange={(e) => setMetaAuthor(e.target.value)}
              />
            </label>
            <label className="block">
              Subject
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={metaSubject}
                onChange={(e) => setMetaSubject(e.target.value)}
              />
            </label>
            <label className="block">
              Keywords
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
              />
            </label>
            <label className="block">
              Creator
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={metaCreator}
                onChange={(e) => setMetaCreator(e.target.value)}
              />
            </label>
            <label className="block">
              Output filename
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={metaOut}
                onChange={(e) => setMetaOut(e.target.value)}
              />
            </label>
          </div>
        )}

        {validationError && (
          <p className="text-sm text-amber-700">{validationError}</p>
        )}

        <button
          type="button"
          disabled={!canRun}
          onClick={() => void onRun()}
          className="w-full py-2.5 rounded-xl bg-neutral-900 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
        >
          {ACTION_LABELS[op]}
        </button>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 min-h-[120px] bg-neutral-50">
        {outPhase === "idle" && (
          <p className="text-sm text-neutral-500">
            Configure an operation and run it
          </p>
        )}

        {outPhase === "processing" && (
          <div className="flex items-center gap-3 text-neutral-700">
            <span className="inline-block h-4 w-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            <span>Processing… {elapsed}s</span>
          </div>
        )}

        {(outPhase === "success" ||
          outPhase === "error" ||
          outPhase === "timeout") && (
          <div className="space-y-3">
            <p
              className={`text-sm ${
                outPhase === "success" ? "text-emerald-800" : "text-red-700"
              }`}
            >
              {outMsg}
            </p>
            {outPhase === "success" && pendingDownload && (
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800"
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
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        row.error
          ? "border-red-300 bg-red-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      {canDrag && !row.error && (
        <button
          type="button"
          className="cursor-grab text-neutral-400"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>
      )}

      <span className="flex-1 truncate text-neutral-900" title={row.file.name}>
        {truncName(row.file.name)}
      </span>

      <span className="text-neutral-500">{fmtSize(row.file.size)}</span>

      <span className="text-neutral-500 w-16 text-right tabular-nums">
        {row.error
          ? "—"
          : row.pageCount === undefined
            ? "…"
            : row.pageCount < 0
              ? "—"
              : row.pageCount}
      </span>

      {row.warn && !row.error && (
        <span
          className="text-xs text-amber-600 max-w-[140px] truncate"
          title={MSG.largeWarn}
        >
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
