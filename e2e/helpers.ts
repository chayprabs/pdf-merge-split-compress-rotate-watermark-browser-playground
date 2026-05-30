import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function waitForEngineReady(page: Page) {
  await expect(page.getByText(/Ready/)).toBeVisible({
    timeout: 120_000,
  });
}

export async function uploadPdf(
  page: Page,
  inputSelector: string,
  paths: string[],
) {
  await page.locator(inputSelector).setInputFiles(paths);
  // Wait for WASM page-count probe (shows "…" then a number or "—")
  await expect(page.locator("li").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const cells = document.querySelectorAll("li span.tabular-nums");
      if (!cells.length) return false;
      const t = cells[cells.length - 1]?.textContent?.trim() ?? "";
      return t !== "…" && t.length > 0;
    },
    { timeout: 60_000 },
  );
}

export async function runAndDownload(
  page: Page,
  actionName: string,
  downloadNamePart: string,
): Promise<void> {
  await page.getByRole("button", { name: actionName }).click();
  const downloadBtn = page.getByRole("button", {
    name: new RegExp(`Download.*${downloadNamePart}`, "i"),
  });
  await expect(downloadBtn).toBeVisible({ timeout: 120_000 });
  await downloadBtn.click();
}
