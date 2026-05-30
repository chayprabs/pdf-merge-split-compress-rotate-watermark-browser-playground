import { test, expect } from "@playwright/test";
import path from "node:path";
import { waitForEngineReady, uploadPdf } from "./helpers";

const fixtures = path.resolve("e2e", "fixtures");
const onePage = path.join(fixtures, "one-page.pdf");
const onePageB = path.join(fixtures, "one-page-b.pdf");
const twoPage = path.join(fixtures, "two-page.pdf");

const fileInput = 'input[type="file"]';

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForEngineReady(page);
});

test("rejects non-PDF upload", async ({ page }) => {
  await page.locator(fileInput).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByText("Only PDF files are accepted.")).toBeVisible();
});

test("merge two PDFs shows success and download", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage, onePageB]);
  await page.getByRole("button", { name: "Merge PDFs" }).click();
  await expect(
    page.getByRole("button", { name: /Download merged\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Merged 2 files/)).toBeVisible();
});

test("split by page range into multiple files", async ({ page }) => {
  await uploadPdf(page, fileInput, [twoPage]);
  await page.getByRole("button", { name: "Split" }).click();
  await page.getByPlaceholder("1-3, 5, 7-9").fill("1");
  await page.getByRole("button", { name: "Split PDF" }).click();
  await expect(
    page.getByRole("button", { name: /Download split/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("extract pages to single PDF", async ({ page }) => {
  await uploadPdf(page, fileInput, [twoPage]);
  await page.getByRole("button", { name: "Split" }).click();
  await page.getByLabel("Extract pages (single PDF)").check();
  await page.getByPlaceholder("1-3, 5, 7-9").fill("1");
  await page.getByRole("button", { name: "Split PDF" }).click();
  await expect(
    page.getByRole("button", { name: /Download split\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("remove pages", async ({ page }) => {
  await uploadPdf(page, fileInput, [twoPage]);
  await page.getByRole("button", { name: "Split" }).click();
  await page.getByLabel("Remove pages").check();
  await page.getByPlaceholder("1-3, 5, 7-9").fill("2");
  await page.getByRole("button", { name: "Split PDF" }).click();
  await expect(
    page.getByRole("button", { name: /Download split\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("compress PDF", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage]);
  await page.getByRole("button", { name: "Compress" }).click();
  await page.getByRole("button", { name: "Compress PDF" }).click();
  await expect(
    page.getByRole("button", { name: /Download compressed\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("rotate PDF", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage]);
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("button", { name: "Rotate PDF" }).click();
  await expect(
    page.getByRole("button", { name: /Download rotated\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("watermark PDF", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage]);
  await page.getByRole("button", { name: "Watermark" }).click();
  await page.getByRole("button", { name: "Watermark PDF" }).click();
  await expect(
    page.getByRole("button", { name: /Download watermarked\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("set PDF metadata", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage]);
  await page.getByRole("button", { name: "Metadata" }).click();
  await page.getByLabel("Title").fill("Test Document");
  await page.getByRole("button", { name: "Update Metadata" }).click();
  await expect(
    page.getByRole("button", { name: /Download metadata\.pdf/i }),
  ).toBeVisible({ timeout: 120_000 });
});

test("merge requires at least two files", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage]);
  await expect(
    page.getByText("Select at least 2 files to merge."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge PDFs" })).toBeDisabled();
});

test("invalid page range shows validation message", async ({ page }) => {
  await uploadPdf(page, fileInput, [onePage]);
  await page.getByRole("button", { name: "Split" }).click();
  await page.getByPlaceholder("1-3, 5, 7-9").fill("abc");
  await expect(
    page.getByText("Invalid page range. Use formats like 1-3, 5, 7-9."),
  ).toBeVisible();
});
