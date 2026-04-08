"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  extractPages,
  waitForPdfcpuRuntime,
  downloadPDF,
  PdfcpuError,
} from "@/lib/engine";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [pages, setPages] = useState("");

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    setFile(files[0] || null);
  }, []);

  const handleExtract = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    if (!pages.trim()) {
      setError("Please enter page numbers to extract (e.g., 1,2,3 or 1-5)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(URL.createObjectURL(file));
      const blob = await response.arrayBuffer();
      const pdfData = new Uint8Array(blob);

      const pageNumbers = pages
        .split(",")
        .map((p) => parseInt(p.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      if (pageNumbers.length === 0) {
        setError("Please enter valid page numbers");
        setLoading(false);
        return;
      }

      const extracted = await extractPages(pdfData, pageNumbers);
      downloadPDF(extracted, "extracted.pdf");
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to extract pages"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Extract Pages</h1>

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
                  Pages to extract (e.g., 1,2,3 or 1-5):
                </label>
                <input
                  type="text"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="1,2,3 or 1-5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate page numbers with commas. Use hyphen for ranges.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExtract}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Extracting..." : "Extract Pages"}
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