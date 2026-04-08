"use client";

import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import {
  setMetadata,
  waitForPdfcpuRuntime,
  downloadPDF,
  PdfcpuError,
  PDFMetadata,
} from "@/lib/engine";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
  const [creator, setCreator] = useState("");

  useEffect(() => {
    waitForPdfcpuRuntime()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const handleFileChange = useCallback((files: File[]) => {
    setFile(files[0] || null);
  }, []);

  const handleSetMetadata = async () => {
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    if (!title && !author && !subject && !keywords && !creator) {
      setError("Please enter at least one metadata field");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(URL.createObjectURL(file));
      const blob = await response.arrayBuffer();
      const pdfData = new Uint8Array(blob);

      const meta: PDFMetadata = {};
      if (title) meta.title = title;
      if (author) meta.author = author;
      if (subject) meta.subject = subject;
      if (keywords) meta.keywords = keywords;
      if (creator) meta.creator = creator;

      const result = await setMetadata(pdfData, meta);
      downloadPDF(result, "with-metadata.pdf");
    } catch (err) {
      setError(
        err instanceof PdfcpuError ? err.message : "Failed to set metadata"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Set Metadata</h1>

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
                  <label className="block text-sm font-medium mb-2">Title:</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Author:</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subject:</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Keywords:</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="comma, separated, keywords"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Creator:</label>
                  <input
                    type="text"
                    value={creator}
                    onChange={(e) => setCreator(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSetMetadata}
                disabled={loading}
                className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Setting metadata..." : "Set Metadata"}
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