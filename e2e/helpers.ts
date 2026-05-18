import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function waitForEngineReady(page: Page) {
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 120_000,
  });
}

export async function uploadPdf(
  page: Page,
  inputSelector: string,
  paths: string[],
) {
  await page.locator(inputSelector).setInputFiles(paths);
}

export async function runAndDownload(
  page: Page,
  downloadNamePart: string,
): Promise<void> {
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Processing…")).toBeVisible();
  const downloadBtn = page.getByRole("button", {
    name: new RegExp(`Download.*${downloadNamePart}`, "i"),
  });
  await expect(downloadBtn).toBeVisible({ timeout: 120_000 });
  await downloadBtn.click();
}
