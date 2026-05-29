#!/usr/bin/env bash
set -euo pipefail
echo "Building WASM with $(go version)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/wasm/pdfcpu"
go mod download
GOROOT="$(go env GOROOT)"
GOOS=js GOARCH=wasm go build -o "$ROOT/public/engine-pdfcpu.wasm" .
cd "$ROOT"
WASM_EXEC_JS=""
for candidate in "$GOROOT/lib/wasm/wasm_exec.js" "$GOROOT/misc/wasm/wasm_exec.js"; do
  if [[ -f "$candidate" ]]; then
    WASM_EXEC_JS="$candidate"
    break
  fi
done
if [[ -z "$WASM_EXEC_JS" ]]; then
  echo "error: wasm_exec.js not found under GOROOT=$GOROOT (checked lib/wasm and misc/wasm)" >&2
  exit 1
fi
cp "$WASM_EXEC_JS" "$ROOT/public/wasm_exec.js"
echo "Built: public/engine-pdfcpu.wasm"
echo "Copied wasm_exec.js from $WASM_EXEC_JS"
if command -v wasm-opt &>/dev/null; then
  wasm-opt -O2 "$ROOT/public/engine-pdfcpu.wasm" -o "$ROOT/public/engine-pdfcpu.wasm"
  echo "Optimized with wasm-opt"
fi
ls -la "$ROOT/public/engine-pdfcpu.wasm" "$ROOT/public/wasm_exec.js"
