"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  splitPDF,
  waitForPdfcpuRuntime,
  PdfcpuError,
  SplitConfig,
} from "@/lib/engine";
import { zipSync } from "fflate";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [splitMode, setSplitMode] = useState<"range" | "every">("every");
  const [pageRange, setPageRange] = useState("");
  const [everyN, setEveryN] = useState(1);

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    setFile(files[0] || null);
  }, []);

  const downloadZip = (files: { name: string; data: Uint8Array }[]) => {
    const zipFiles: Record<string, Uint8Array> = {};
    for (const f of files) {
      zipFiles[f.name] = f.data;
    }
    const zipped = zipSync(zipFiles);
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "split-files.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSplit = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const buffer = new ArrayBuffer(file.size);
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      await new Promise((resolve) => {
        reader.onload = resolve;
      });
      const pdfData = new Uint8Array(reader.result as ArrayBuffer);

      let config: SplitConfig;
      if (splitMode === "range") {
        if (!pageRange.trim()) {
          setError("Please enter a page range (e.g., 1-3,5,7-9)");
          setLoading(false);
          return;
        }
        config = { pages: pageRange, span: 0 };
      } else {
        if (everyN < 1) {
          setError("Please enter a valid number of pages per split");
          setLoading(false);
          return;
        }
        config = { span: everyN };
      }

      const results = await splitPDF(pdfData, config);

      if (results.length === 0) {
        setError("No pages to split");
        setLoading(false);
        return;
      }

      const filesToZip = results.map((r, i) => ({
        name: `page-${r.from}-${r.thru}.pdf`,
        data: r.data,
      }));

      downloadZip(filesToZip);
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to split PDF"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Split PDF</h1>

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
                  Split mode:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="splitMode"
                      value="every"
                      checked={splitMode === "every"}
                      onChange={() => setSplitMode("every")}
                    />
                    Every N pages
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="splitMode"
                      value="range"
                      checked={splitMode === "range"}
                      onChange={() => setSplitMode("range")}
                    />
                    By page range
                  </label>
                </div>
              </div>

              {splitMode === "every" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Pages per split:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={everyN}
                    onChange={(e) => setEveryN(parseInt(e.target.value) || 1)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              {splitMode === "range" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Page ranges (e.g., 1-3,5,7-9):
                  </label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    placeholder="1-3,5,7-9"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate ranges with commas. Use hyphen for ranges.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSplit}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Splitting..." : "Split PDF"}
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