import { test, expect } from "@playwright/test";
import { waitForEngineReady } from "./helpers";

test("home loads and engine reaches Ready", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Press" })).toBeVisible();
  await waitForEngineReady(page);
});

test("privacy and terms routes exist", async ({ page }) => {
  for (const p of ["/privacy/", "/terms/"]) {
    const res = await page.goto(p);
    expect(res?.ok()).toBeTruthy();
  }
});

test("header has external links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("GitHub repository")).toBeVisible();
  await expect(page.getByLabel("Chaitanya Prabuddha on X")).toBeVisible();
  await expect(page.getByLabel("Personal website")).toBeVisible();
});

test("all six operation buttons are visible", async ({ page }) => {
  await page.goto("/");
  await waitForEngineReady(page);
  for (const name of [
    "Merge",
    "Split",
    "Compress",
    "Rotate",
    "Watermark",
    "Metadata",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
});
