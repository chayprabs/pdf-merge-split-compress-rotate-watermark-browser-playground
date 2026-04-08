"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  validatePDF,
  waitForPdfcpuRuntime,
  PdfcpuError,
  ValidationResult,
} from "@/lib/engine";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    setFile(files[0] || null);
    setResult(null);
  }, []);

  const handleValidate = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      await new Promise((resolve) => {
        reader.onload = resolve;
      });
      const pdfData = new Uint8Array(reader.result as ArrayBuffer);

      const validationResult = await validatePDF(pdfData);
      setResult(validationResult);
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to validate PDF"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Validate PDF</h1>

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

              <button
                type="button"
                onClick={handleValidate}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Validating..." : "Validate PDF"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {result && (
            <div
              className={`mt-6 p-6 rounded-lg ${
                result.valid
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {result.valid ? (
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                <h3 className="text-xl font-bold">
                  {result.valid ? "Valid PDF" : "Invalid PDF"}
                </h3>
              </div>
              {!result.valid && result.error && (
                <p className="text-red-700">{result.error}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}