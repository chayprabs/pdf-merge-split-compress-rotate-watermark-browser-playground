# Press

Browser-based PDF workspace — fully client-side using [pdfcpu](https://github.com/pdfcpu/pdfcpu) compiled to WebAssembly. No file data is sent to a server.

## Tools (6 operations)

| Tool | What it does |
|------|----------------|
| **Merge** | Combine 2–20 PDFs in order; optional blank divider pages between documents |
| **Split** | Split into multiple files by range, every N pages, extract pages to one PDF, or remove pages |
| **Compress** | Optimize PDF structure (low / medium / high quality); batch up to 10 files |
| **Rotate** | Rotate 90°, 180°, or 270° on all pages or a page range |
| **Watermark** | Add text watermark with position, opacity, size, colour, rotation, page range, and layer (on top or behind) |
| **Metadata** | Set PDF title, author, subject, keywords, and creator |

All tools support custom output filenames and auto-download on success.

## Requirements

- Node.js 20+
- Go 1.21+ (CI uses 1.24 to match `wasm/pdfcpu`)

## Develop

```bash
bash scripts/build-wasm.sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

WASM artifacts (`public/engine-pdfcpu.wasm`, `public/wasm_exec.js`) are gitignored — run `build-wasm.sh` before dev or production build.

## Production static build

```bash
bash scripts/build-wasm.sh
npm ci
npm run build
```

Output: `out/`. Test locally:

```bash
npm run serve:static
```

Open [http://localhost:3001](http://localhost:3001).

## Deploy (Cloudflare Pages)

| Setting | Value |
|---------|-------|
| Build command | `bash scripts/build-wasm.sh && npm ci && npm run build` |
| Output directory | `out` |
| Go version | 1.24 |

Use [`public/_headers`](public/_headers) for COOP/COEP headers required by WebAssembly.

## Tests

```bash
npm test              # Vitest (unit)
npm run test:e2e      # Playwright (needs `out/` from `npm run build`)
```

## Limits

- PDF only; max 200 MB per file, 500 MB total per session
- Password-protected PDFs are not supported
- Compress uses pdfcpu optimize (structure cleanup), not image recompression

## Legal

- [Privacy Policy](/privacy/)
- [Terms & Conditions](/terms/)

## License

MIT — see [LICENSE](LICENSE). pdfcpu is Apache 2.0 — see [NOTICE](NOTICE).

## Author

[Chaitanya Prabuddha](https://www.chaitanyaprabuddha.com)
