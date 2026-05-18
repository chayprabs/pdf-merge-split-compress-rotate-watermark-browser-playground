/**
 * Writes pdfcpu-compatible PDF fixtures for Playwright.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "e2e", "fixtures");
mkdirSync(outDir, { recursive: true });

async function writeOnePage(path, label) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(label, { x: 72, y: 700, size: 24, font, color: rgb(0, 0, 0) });
  writeFileSync(path, await doc.save());
}

async function writeTwoPage(path) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 2; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i}`, {
      x: 72,
      y: 700,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
  }
  writeFileSync(path, await doc.save());
}

await writeOnePage(join(outDir, "one-page.pdf"), "Fixture A");
await writeOnePage(join(outDir, "one-page-b.pdf"), "Fixture B");
await writeTwoPage(join(outDir, "two-page.pdf"));
console.log("Wrote e2e/fixtures/*.pdf (pdf-lib)");
