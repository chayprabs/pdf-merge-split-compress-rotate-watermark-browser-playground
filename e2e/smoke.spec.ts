import { test, expect } from "@playwright/test";

test("home loads and engine reaches Ready", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Press" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 120_000,
  });
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
