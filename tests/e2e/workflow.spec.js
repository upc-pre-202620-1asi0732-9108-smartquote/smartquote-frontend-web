import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fixture } from "../support/pdf-fixture.js";
const credentials = {
  production: "production@smartquote.local",
  manager: "manager@smartquote.local",
};
async function signIn(page, role) {
  await page.getByLabel("Email address", { exact: true }).fill(credentials[role]);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SMARTQUOTE_BOOTSTRAP_PASSWORD || "");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
test("English default, Spanish persistence and responsive access screen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to SmartQuote" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "Español", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión en SmartQuote" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-419");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("IAM login authenticates a production account through the local API", async ({
  page,
}) => {
  test.skip(
    process.env.SMARTQUOTE_E2E_AUTH !== "1" ||
      !process.env.SMARTQUOTE_BOOTSTRAP_PASSWORD,
    "Requires a local API with bootstrapped IAM accounts and SMARTQUOTE_BOOTSTRAP_PASSWORD",
  );
  await page.goto("/");
  await signIn(page, "production");
  await expect(
    page.getByRole("button", { name: "New request", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to SmartQuote" }),
  ).toBeVisible();
});
test("production creates a request and manager completes the purchasing workflow against the real API", async ({
  page,
}) => {
  test.skip(
    process.env.SMARTQUOTE_E2E_REAL !== "1" ||
      !process.env.SMARTQUOTE_BOOTSTRAP_PASSWORD ||
      process.env.SMARTQUOTE_E2E_STUB !== "1",
    "Requires a local Stub AI backend, bootstrapped IAM accounts and SMARTQUOTE_BOOTSTRAP_PASSWORD",
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await signIn(page, "production");
  await page.getByRole("button", { name: "New request", exact: true }).click();
  const description = "Browser integration " + Date.now();
  await page
    .getByLabel("Required date", { exact: true })
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Description", { exact: true }).fill(description);
  await page.getByLabel("Unit", { exact: true }).first().fill("unit");
  await page
    .getByLabel("Requirement name", { exact: true })
    .fill("documentReference");
  await page.getByRole("combobox", { name: "Operator", exact: true }).click();
  await page.getByRole("option", { name: "Contains", exact: true }).click();
  await page.getByLabel("Expected value", { exact: true }).fill("a");
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: description, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, "manager");
  await page
    .getByRole("button", { name: "Open " + description, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: description, exact: true, level: 1 }),
  ).toBeVisible();
  async function changeStatus(next) {
    await page
      .getByRole("button", { name: "Change status", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Change status",
      exact: true,
    });
    await dialog
      .getByRole("combobox", { name: "Next status", exact: true })
      .click();
    await page.getByRole("option", { name: next, exact: true }).click();
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("Browser integration review");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh", exact: true }),
    ).toBeEnabled();
  }
  await changeStatus("Under review");
  await changeStatus("Collecting quotations");
  await page.getByRole("tab", { name: /Quotations/ }).click();
  for (const supplier of ["Browser supplier A", "Browser supplier B"]) {
    await page
      .getByRole("button", { name: "Upload quotations", exact: true })
      .click();
    const upload = page.getByRole("dialog", {
      name: "Upload quotations",
      exact: true,
    });
    await upload
      .getByLabel("Supplier reference", { exact: true })
      .fill(supplier);
    await upload
      .getByLabel("Tax identifier", { exact: true })
      .fill("TEST-BROWSER-" + supplier.slice(-1));
    await upload.getByLabel("Business name", { exact: true }).fill(supplier);
    const pdf = fixture(supplier);
    await upload.getByLabel("Select PDF files", { exact: true }).setInputFiles({
      name: pdf.name,
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.arrayBuffer()),
    });
    await upload.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(
      upload.getByText(pdf.name + " · Completed", { exact: true }),
    ).toBeVisible();
    await upload.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Process PDF", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: supplier, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh", exact: true }),
    ).toBeEnabled();
    await page.getByRole("combobox", { name: /Select an item/ }).click();
    await page.getByRole("option", { name: description, exact: true }).click();
    await page
      .getByLabel("I reviewed the extracted fields and line mappings.", {
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Verify quotation", exact: true })
      .click();
    await expect(
      page.getByText("Quotation verified.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh", exact: true }),
    ).toBeEnabled();
  }
  await changeStatus("Evaluation");
  await page.getByRole("tab", { name: "Comparison", exact: true }).click();
  await page
    .getByRole("button", { name: "Save criteria version", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run comparison", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Run comparison", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Browser supplier [AB]$/ }).first(),
  ).toBeVisible();
  mkdirSync(".local", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".local/vue-comparison-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Review purchase order", exact: true })
    .click();
  await page
    .getByLabel("Delivery destination", { exact: true })
    .fill("Test warehouse");
  await page
    .getByLabel("Delivery conditions", { exact: true })
    .fill("Receiving hours 8-16");
  await page
    .getByLabel("I reviewed the quotation and authorize this purchase order.", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Approve and generate order", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Print order", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark request as ordered", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark request as ordered", exact: true }),
  ).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".local/vue-order-narrow-web.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});
