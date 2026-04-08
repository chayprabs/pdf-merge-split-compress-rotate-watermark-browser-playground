"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  addWatermark,
  waitForPdfcpuRuntime,
  downloadPDF,
  PdfcpuError,
  WatermarkConfig,
} from "@/lib/engine";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [text, setText] = useState("WATERMARK");
  const [opacity, setOpacity] = useState("0.3");
  const [rotation, setRotation] = useState("45");
  const [onTop, setOnTop] = useState(true);

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    setFile(files[0] || null);
  }, []);

  const handleWatermark = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    if (!text.trim()) {
      setError("Please enter watermark text");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(URL.createObjectURL(file));
      const blob = await response.arrayBuffer();
      const pdfData = new Uint8Array(blob);

      const config: WatermarkConfig = {
        text,
        opacity,
        rotation,
        onTop,
      };

      const result = await addWatermark(pdfData, config);
      downloadPDF(result, "watermarked.pdf");
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to add watermark"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Add Watermark</h1>

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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Watermark text:
                  </label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity (0.1 to 1.0):
                  </label>
                  <input
                    type="text"
                    value={opacity}
                    onChange={(e) => setOpacity(e.target.value)}
                    placeholder="0.3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rotation (degrees):
                  </label>
                  <input
                    type="text"
                    value={rotation}
                    onChange={(e) => setRotation(e.target.value)}
                    placeholder="45"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={onTop}
                      onChange={(e) => setOnTop(e.target.checked)}
                    />
                    Place on top of content
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWatermark}
                disabled={loading}
                className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Adding watermark..." : "Add Watermark"}
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