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
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function DropZone({
  items,
  onItemsChange,
  multiple = true,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptList = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);

      if (!multiple) {
        const batch: StagedFile[] = [];
        for (const file of list) {
          const v = validatePdfFile(file);
          if (!v.ok || !v.file) {
            batch.push({
              id: makeId(),
              file,
              error: v.error ?? MSG.wrongType,
            });
            continue;
          }
          if (wouldExceedTotal([], [v.file])) {
            batch.push({
              id: makeId(),
              file: v.file,
              error: MSG.totalTooLarge,
            });
            continue;
          }
          batch.push({
            id: makeId(),
            file: v.file,
            warn: v.warn,
          });
        }
        const valids = batch.filter((b) => !b.error);
        const invalids = batch.filter((b) => b.error);
        const one = valids.length ? [valids[valids.length - 1]] : [];
        onItemsChange([...invalids, ...one]);
        return;
      }

      const currentFiles = items.filter((i) => !i.error).map((i) => i.file);
      const next: StagedFile[] = [...items];
      const rejected: StagedFile[] = [];

      for (const file of list) {
        const v: FileAcceptance = validatePdfFile(file);
        if (!v.ok || !v.file) {
          rejected.push({
            id: makeId(),
            file,
            error: v.error ?? MSG.wrongType,
          });
          continue;
        }
        if (wouldExceedTotal(currentFiles, [v.file])) {
          rejected.push({
            id: makeId(),
            file: v.file,
            error: MSG.totalTooLarge,
          });
          continue;
        }
        currentFiles.push(v.file);
        next.push({
          id: makeId(),
          file: v.file,
          warn: v.warn,
        });
      }

      onItemsChange([...next, ...rejected]);
    },
    [items, multiple, onItemsChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) acceptList(e.dataTransfer.files);
    },
    [acceptList],
  );

  const handleClick = useCallback(() => inputRef.current?.click(), []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) acceptList(e.target.files);
      e.target.value = "";
    },
    [acceptList],
  );

  return (
    <div>
      <button
        type="button"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          className="hidden"
          onChange={handleFileSelect}
        />
        <p className="text-gray-600 dark:text-gray-400">
          {isDragging
            ? "Drop PDF files here"
            : "Drag and drop PDF files or click to browse"}
        </p>
        <p className="text-sm text-gray-400 mt-2">PDF files only</p>
      </button>
    </div>
  );
}
