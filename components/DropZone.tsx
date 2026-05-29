"use client";

import { useRef, useState, useCallback } from "react";
import type { FileAcceptance } from "@/lib/fileUtils";
import { validatePdfFile, wouldExceedTotal, MSG } from "@/lib/fileUtils";

export interface StagedFile {
  id: string;
  file: File;
  error?: string;
  warn?: string;
}

interface DropZoneProps {
  items: StagedFile[];
  onItemsChange: (items: StagedFile[]) => void;
  multiple?: boolean;
  hint?: string;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function DropZone({
  items,
  onItemsChange,
  multiple = true,
  hint,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptList = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);

      if (!multiple) {
        const batch: StagedFile[] = [];
        for (const file of list) {
          const v = validatePdfFile(file);
          if (!v.ok || !v.file) {
            batch.push({ id: makeId(), file, error: v.error ?? MSG.wrongType });
            continue;
          }
          if (wouldExceedTotal([], [v.file])) {
            batch.push({ id: makeId(), file: v.file, error: MSG.totalTooLarge });
            continue;
          }
          batch.push({ id: makeId(), file: v.file, warn: v.warn });
        }
        const valids = batch.filter((b) => !b.error);
        const invalids = batch.filter((b) => b.error);
        const one = valids.length ? [valids[valids.length - 1]] : [];
        if (list.length > 1 && valids.length > 1) {
          invalids.unshift({
            id: makeId(),
            file: list[0],
            error: "Only one PDF at a time for this operation.",
          });
        }
        onItemsChange([...invalids, ...one]);
        return;
      }

      const currentFiles = items.filter((i) => !i.error).map((i) => i.file);
      const next: StagedFile[] = [...items];
      const rejected: StagedFile[] = [];

      for (const file of list) {
        const v: FileAcceptance = validatePdfFile(file);
        if (!v.ok || !v.file) {
          rejected.push({ id: makeId(), file, error: v.error ?? MSG.wrongType });
          continue;
        }
        if (wouldExceedTotal(currentFiles, [v.file])) {
          rejected.push({ id: makeId(), file: v.file, error: MSG.totalTooLarge });
          continue;
        }
        currentFiles.push(v.file);
        next.push({ id: makeId(), file: v.file, warn: v.warn });
      }

      onItemsChange([...next, ...rejected]);
    },
    [items, multiple, onItemsChange],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length) acceptList(e.dataTransfer.files);
    },
    [acceptList],
  );

  return (
    <div>
      <button
        type="button"
        aria-label="Upload PDF files. Drag and drop or click to browse."
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? "border-neutral-400 bg-neutral-50"
            : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) acceptList(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-neutral-600">
          {isDragging ? "Drop PDF files here" : "Drop PDF files here or click to browse"}
        </p>
        {hint && <p className="mt-2 text-xs text-neutral-400">{hint}</p>}
      </button>
    </div>
  );
}
