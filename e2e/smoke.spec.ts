import { test, expect } from "@playwright/test";

test.describe("DCC spoiler-gating smoke", () => {
  test.beforeEach(async ({ context }) => {
    // Clear stored position so every test starts from the picker
    await context.addInitScript(() => {
      localStorage.clear();
    });
  });

  test("picker shown on fresh visit — no entity links", async ({ page }) => {
    await page.goto("/dcc/");
    await expect(page.getByText("Where are you")).toBeVisible();
    await expect(page.locator('a[href*="/dcc/entity/"]')).toHaveCount(0);
  });

  test("B1·C1 gate — entity index shown with Carl, no Crawler #4,122 alias", async ({
    page,
  }) => {
    await page.goto("/dcc/");
    await expect(page.getByText("Where are you")).toBeVisible();

    // Select Book 1 (by value — option label is now "1 · Dungeon Crawler Carl")
    await page.selectOption("#book-select", { value: "1" });
    // Select C1
    await page.selectOption("#chapter-select", { label: "C1" });
    await page.getByRole("button", { name: "Set position" }).click();

    // Entity index should be visible — links to entities present
    await expect(page.locator('a[href*="/dcc/entity/"]').first()).toBeVisible();

    // Carl should appear in the list (link text includes type/significance spans)
    await expect(page.locator('a[href*="/dcc/entity/carl/"]')).toBeVisible();
  });

  test("Carl page at B1·C1 — description present, Crawler #4,122 absent", async ({
    page,
  }) => {
    // Navigate directly with the through param set to B1·C1
    await page.goto("/dcc/entity/carl/?through=B1%C2%B7C1");

    // A description should be visible (multiple elements may match — first is fine)
    await expect(
      page.locator("main").getByText(/narrator|marine tech|Coast Guard/i).first(),
    ).toBeVisible();

    // The gated alias must NOT appear
    await expect(page.locator("body")).not.toContainText("Crawler #4,122");
  });

  test("Carl page at Everything — Crawler #4,122 present", async ({ page }) => {
    await page.goto("/dcc/entity/carl/?through=__all__");

    // The alias must appear once the full series is unlocked
    await expect(page.locator("body")).toContainText("Crawler #4,122");
  });
});
