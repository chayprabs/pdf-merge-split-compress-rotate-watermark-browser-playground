#!/usr/bin/env bash
set -euo pipefail
echo "Building WASM with $(go version)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/wasm/pdfcpu"
go mod download
GOOS=js GOARCH=wasm go build -o "$ROOT/public/engine-pdfcpu.wasm" .
cd "$ROOT"
GOROOT="$(go env GOROOT)"
cp "$GOROOT/misc/wasm/wasm_exec.js" "$ROOT/public/wasm_exec.js"
echo "Built: public/engine-pdfcpu.wasm"
echo "Copied wasm_exec.js from $GOROOT"
if command -v wasm-opt &>/dev/null; then
  wasm-opt -O2 "$ROOT/public/engine-pdfcpu.wasm" -o "$ROOT/public/engine-pdfcpu.wasm"
  echo "Optimized with wasm-opt"
fi
ls -la "$ROOT/public/engine-pdfcpu.wasm" "$ROOT/public/wasm_exec.js"
