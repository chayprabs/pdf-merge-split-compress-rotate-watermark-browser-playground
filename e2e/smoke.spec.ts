import { test, expect } from "@playwright/test";

test("home loads and engine reaches Ready", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Press" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 120_000,
  });
});

test("privacy, terms, credits routes exist", async ({ page }) => {
  for (const p of ["/privacy/", "/terms/", "/credits/"]) {
    const res = await page.goto(p);
    expect(res?.ok()).toBeTruthy();
  }
});
