"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DropZone } from "@/components/DropZone";
import {
  mergePDFs,
  waitForPdfcpuRuntime,
  downloadPDF,
  PdfcpuError,
} from "@/lib/engine";

interface SortableFile extends File {
  id: string;
}

function SortableItem({
  file,
  index,
  onRemove,
}: {
  file: File;
  index: number;
  onRemove: () => void;
}) {
  const sortableFile = file as SortableFile;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableFile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 hover:text-gray-600"
        aria-label="Drag to reorder"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
        </svg>
      </button>
      <span className="text-sm font-medium text-gray-700">{index + 1}.</span>
      <span className="flex-1 truncate text-sm">{file.name}</span>
      <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 text-xl"
      >
        ×
      </button>
    </li>
  );
}

export default function Page() {
  const [files, setFiles] = useState<SortableFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    const sortableFiles: SortableFile[] = newFiles.map((f, i) => {
      const sf = f as SortableFile;
      sf.id = `${f.name}-${i}-${Date.now()}`;
      return sf;
    });
    setFiles(sortableFiles);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setError("Please add at least 2 PDF files to merge");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileArray: Uint8Array[] = await Promise.all(
        files.map(async (f) => {
          const response = await fetch(URL.createObjectURL(f));
          const blob = await response.arrayBuffer();
          return new Uint8Array(blob);
        })
      );

      const merged = await mergePDFs(fileArray);
      downloadPDF(merged, "merged.pdf");
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to merge PDFs"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Merge PDFs</h1>

      {!isReady && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading PDF engine...</p>
          </div>
        </div>
      )}

      {error && !isReady && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {isReady && (
        <>
          <DropZone
            onFiles={handleFilesChange}
            multiple
            accept="application/pdf"
          />

          {files.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-3">
                Files to merge ({files.length})
              </h2>
              <p className="text-sm text-gray-600 mb-3">
                Drag to reorder files
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={files.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {files.map((file, index) => (
                      <SortableItem
                        key={file.id}
                        file={file}
                        index={index}
                        onRemove={() => removeFile(file.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={handleMerge}
                disabled={loading || files.length < 2}
                className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Merging..." : "Merge PDFs"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}