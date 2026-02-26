import { test, expect } from "@playwright/test";

test("homepage renders with expected title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ZML/i);
});

test("homepage shows unauthenticated landing content", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "The Ultimate Music League" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Your League" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ready to Prove Your Music Taste?" }),
  ).toBeVisible();
});

test("signin page renders Discord sign-in call to action", async ({ page }) => {
  await page.goto("/signin");

  await expect(page.getByRole("heading", { name: "Welcome to ZML" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in with discord/i }),
  ).toBeVisible();
});
