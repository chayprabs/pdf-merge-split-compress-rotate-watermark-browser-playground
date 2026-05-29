# Press

Browser-based PDF workspace: **merge**, **split**, **compress**, **rotate**, and **watermark** — fully client-side using [pdfcpu](https://github.com/pdfcpu/pdfcpu) compiled to WebAssembly. No file data is sent to a server.

**Live:** Deploy the static `out/` folder to Cloudflare Pages or any static host with COOP/COEP headers (see [`public/_headers`](public/_headers)).

## Features

- Merge up to 20 PDFs with drag-to-reorder
- Split by page range or every N pages
- Compress with low / medium / high quality
- Rotate 90°, 180°, or 270° (all pages or a range)
- Text watermark with position, opacity, size, colour, and rotation
- Share operation settings via URL hash (files never included)

## Requirements

- Node.js 20+
- Go 1.21+ (CI uses 1.24 to match `wasm/pdfcpu`)

## Develop

```bash
# Build WASM + copy wasm_exec.js from the same Go toolchain
bash scripts/build-wasm.sh

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** WASM artifacts (`public/engine-pdfcpu.wasm`, `public/wasm_exec.js`) are gitignored and must be built before dev or production build.

## Production static build

```bash
bash scripts/build-wasm.sh
npm ci
npm run build
```

Output: `out/`. Test locally with correct COOP/COEP + MIME types:

```bash
npm run serve:static
```

Then open [http://localhost:3001](http://localhost:3001).

## Deploy (Cloudflare Pages)

| Setting | Value |
|---------|-------|
| Build command | `bash scripts/build-wasm.sh && npm ci && npm run build` |
| Output directory | `out` |
| Go version | 1.24 (install via build environment) |

Copy [`public/_headers`](public/_headers) rules to your host. WASM must be served as `application/wasm`.

## Tests

```bash
npm test              # Vitest (unit)
npm run test:e2e      # Playwright (needs `out/` from `npm run build`)
```

## Security headers

With `output: 'export'`, Next.js does not emit custom `headers()`. Use [`public/_headers`](public/_headers) on **Cloudflare Pages** (or your host's equivalent). Local `serve-static` applies the same policies for smoke testing.

## Limitations

- Password-protected PDFs are not supported
- Maximum 200 MB per file, 500 MB total per session
- Compress uses pdfcpu optimize (structure cleanup), not image recompression

## CI

GitHub Actions builds WASM, runs TypeScript check, ESLint, license-checker, `npm audit`, unit tests, `next build`, and Playwright against `out/`.

## Legal

- [Privacy Policy](/privacy/)
- [Terms & Conditions](/terms/)

## License

MIT — see [LICENSE](LICENSE). pdfcpu is Apache 2.0 — see [NOTICE](NOTICE).

## Author

[Chaitanya Prabuddha](https://www.chaitanyaprabuddha.com)
