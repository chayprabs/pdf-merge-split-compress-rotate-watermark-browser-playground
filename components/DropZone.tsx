"use client";

import { useState, useCallback, useRef } from "react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export function DropZone({ onFiles, accept = "application/pdf", multiple = true }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFiles = useCallback((fileList: FileList | File[]): File[] => {
    const validFiles: File[] = [];
    const items = Array.from(fileList);

    for (const file of items) {
      if (file.type === accept) {
        validFiles.push(file);
      } else {
        console.warn(`Invalid file type: ${file.name}. Expected ${accept}`);
      }
    }

    return validFiles;
  }, [accept]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const validFiles = validateFiles(e.dataTransfer.files);
    if (validFiles.length > 0) {
      const newFiles = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(newFiles);
      onFiles(newFiles);
    }
  }, [files, multiple, onFiles, validateFiles]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        const newFiles = multiple ? [...files, ...validFiles] : validFiles;
        setFiles(newFiles);
        onFiles(newFiles);
      }
    }
  }, [files, multiple, onFiles, validateFiles]);

  const removeFile = useCallback((index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFiles(newFiles);
  }, [files, onFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          border: isDragging ? "2px dashed #3b82f6" : "2px dashed #d1d5db",
          borderRadius: "0.5rem",
          padding: "2rem",
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: isDragging ? "#eff6ff" : "white",
          transition: "all 0.2s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <p style={{ color: "#6b7280" }}>
          {isDragging ? "Drop PDF files here" : "Drag and drop PDF files or click to browse"}
        </p>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          {accept === "application/pdf" ? "PDF files only" : accept}
        </p>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>
            Selected Files ({files.length})
          </h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {files.map((file, index) => (
              <li
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.25rem",
                  marginBottom: "0.25rem",
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {file.name}
                </span>
                <span style={{ color: "#6b7280", fontSize: "0.875rem", margin: "0 1rem" }}>
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}