"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  rotatePDF,
  waitForPdfcpuRuntime,
  downloadPDF,
  PdfcpuError,
} from "@/lib/engine";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [pageSelection, setPageSelection] = useState("");
  const [allPages, setAllPages] = useState(true);

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    setFile(files[0] || null);
  }, []);

  const handleRotate = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      await new Promise((resolve) => {
        reader.onload = resolve;
      });
      const pdfData = new Uint8Array(reader.result as ArrayBuffer);

      let pages: number[] | undefined;
      if (!allPages && pageSelection.trim()) {
        pages = pageSelection
          .split(",")
          .map((p) => parseInt(p.trim()))
          .filter((n) => !isNaN(n));
        if (pages.length === 0) {
          setError("Please enter valid page numbers");
          setLoading(false);
          return;
        }
      }

      const rotated = await rotatePDF(pdfData, rotation, pages);
      downloadPDF(rotated, "rotated.pdf");
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to rotate PDF"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Rotate PDF</h1>

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
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Rotation:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rotation"
                      value="90"
                      checked={rotation === 90}
                      onChange={() => setRotation(90)}
                    />
                    90°
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rotation"
                      value="180"
                      checked={rotation === 180}
                      onChange={() => setRotation(180)}
                    />
                    180°
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rotation"
                      value="270"
                      checked={rotation === 270}
                      onChange={() => setRotation(270)}
                    />
                    270°
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Pages to rotate:
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pageSelection"
                      checked={allPages}
                      onChange={() => setAllPages(true)}
                    />
                    All pages
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pageSelection"
                      checked={!allPages}
                      onChange={() => setAllPages(false)}
                    />
                    Specific pages
                  </label>
                </div>
                {!allPages && (
                  <input
                    type="text"
                    value={pageSelection}
                    onChange={(e) => setPageSelection(e.target.value)}
                    placeholder="1,2,3 or 1-5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleRotate}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Rotating..." : "Rotate PDF"}
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