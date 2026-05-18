# Press

Browser-based PDF workspace: **merge**, **split**, **compress**, **rotate**, and **watermark** — fully client-side using [pdfcpu](https://github.com/pdfcpu/pdfcpu) compiled to WebAssembly. No file data is sent to a server.

## Requirements

- Node.js 20+
- Go 1.21+ (for building the WASM engine; CI uses 1.24 to match `wasm/pdfcpu`)

## Develop

```bash
# Build WASM + copy wasm_exec.js from your Go toolchain
bash scripts/build-wasm.sh

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Tests

```bash
npm test              # Vitest (unit)
npm run test:e2e      # Playwright (needs `out/` from `npm run build`)
```

## Security headers

With `output: 'export'`, Next.js does not emit custom `headers()`. Use [`public/_headers`](public/_headers) on **Cloudflare Pages** (or your host’s equivalent). Local `serve-static` applies the same policies for smoke testing.

## CI

GitHub Actions builds WASM, runs TypeScript check, ESLint, license-checker, `npm audit`, unit tests, `next build`, and Playwright against `out/`.

## License

MIT — see [LICENSE](LICENSE). pdfcpu is Apache 2.0 — see [NOTICE](NOTICE) and [/credits](/credits).
