"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  optimizePDF,
  waitForPdfcpuRuntime,
  downloadPDF,
  PdfcpuError,
} from "@/lib/engine";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null);

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    const f = files[0] || null;
    setFile(f);
    setOriginalSize(f ? f.size : 0);
    setOptimizedSize(null);
  }, []);

  const handleOptimize = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setLoading(true);
    setError(null);
    setOptimizedSize(null);

    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      await new Promise((resolve) => {
        reader.onload = resolve;
      });
      const pdfData = new Uint8Array(reader.result as ArrayBuffer);

      const optimized = await optimizePDF(pdfData);
      setOptimizedSize(optimized.length);
      downloadPDF(optimized, "optimized.pdf");
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to optimize PDF"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const getReduction = () => {
    if (!optimizedSize || !originalSize) return 0;
    return Math.round(((originalSize - optimizedSize) / originalSize) * 100);
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Optimize PDF</h1>

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
            onFiles={handleFileChange}
            multiple={false}
            accept="application/pdf"
          />

          {file && (
            <div className="mt-6">
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <p className="text-sm font-medium">Selected file:</p>
                <p className="text-sm text-gray-600">{file.name}</p>
                <p className="text-xs text-gray-500">
                  Original size: {formatSize(originalSize)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOptimize}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Optimizing..." : "Optimize PDF"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {optimizedSize !== null && (
            <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">
                Optimization Complete!
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Original</p>
                  <p className="text-xl font-bold">{formatSize(originalSize)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Optimized</p>
                  <p className="text-xl font-bold">{formatSize(optimizedSize)}</p>
                </div>
              </div>
              {getReduction() > 0 && (
                <p className="mt-4 text-green-700 font-medium">
                  Reduced by {getReduction()}%
                </p>
              )}
              <p className="mt-4 text-sm text-gray-600">
                Download started automatically.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}