import { test, expect } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const performance = {
  supplierTaxIdentifier: "20123456789", evaluationCount: 1,
  averageOnTimeScore: 5, averageQualityScore: 4, overallScore: 4.5,
  firstEvaluatedAt: "2026-10-05T12:00:00Z", lastEvaluatedAt: "2026-10-05T12:00:00Z",
  evaluations: [{ deliveryEvaluationId: id, purchaseOrderId: id, evaluatedBy: id,
    evaluatedAt: "2026-10-05T12:00:00Z", onTimeScore: 5, qualityScore: 4,
    observations: "Entrega completa sin daños." }],
};

async function loginWithContracts(page, role) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path.endsWith("/iam/auth/login")) body = {
      accessToken: "ui-contract-test-token", expiresIn: 3600,
      user: { userId: id, displayName: "Test buyer", roles: [role] },
    };
    else if (path.endsWith("/iam/auth/refresh"))
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    else if (path.endsWith("/performance")) body = performance;
    else if (path.endsWith("/purchase-requests")) body = { items: [], totalCount: 0, page: 1, pageSize: 12 };
    else return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill("buyer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("contract-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: /Suppliers/ }).click();
}

for (const role of ["PurchaseAnalyst", "PurchaseManager"]) {
  test(`US15 ${role} sees supplier history with traceability`, async ({ page }) => {
    await loginWithContracts(page, role);
    await page.getByLabel("Tax identifier", { exact: true }).fill("20123456789");
    await page.getByRole("button", { name: "Look up supplier", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delivery evaluation history", exact: true })).toBeVisible();
    const row = page.locator("tbody tr");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Entrega completa sin daños.");
    await expect(row).toContainText(id);
    await expect(row).toContainText("5 / 5");
    await expect(row).toContainText("4 / 5");
  });
}

test("US15 analyst evaluates a delivered order without manager-only controls", async ({ page }) => {
  await loginWithContracts(page, "PurchaseAnalyst");
  const request = {
    requestId: id, status: "Ordered", version: 3, priority: "Normal",
    requiredDate: "2026-12-25", createdAt: "2026-10-01T12:00:00Z", updatedAt: "2026-10-05T12:00:00Z",
    nextResponsibleArea: "Purchasing", attachments: [],
    items: [{ itemId: id, description: "Alimento de prueba", quantity: 1000, unitOfMeasure: "kg", requirements: [] }],
  };
  const order = {
    purchaseOrderId: id, orderNumber: "SQ-TEST-001", status: "Delivered",
    supplierBusinessName: "Proveedor de prueba", supplierTaxIdentifier: "20123456789",
    deliveryDestination: "Granja", deliveryConditions: "Entrega completa", deliveryLeadTimeDays: 3,
    currency: "PEN", total: 100, approvedBy: id, approvedAt: "2026-10-05T12:00:00Z", lines: [],
  };
  await page.route(`**/api/v1/purchase-requests/${id}**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path.endsWith("/purchase-order")) body = order;
    else if (path.endsWith("/history")) body = { entries: [] };
    else if (path.endsWith("/quotations") || path.endsWith("/simulations")) body = [];
    else if (path.endsWith("/evaluation-scenario"))
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    else body = request;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  let submitted;
  await page.route(`**/api/v1/purchase-orders/${id}/delivery-evaluation`, (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(performance.evaluations[0]) });
  });
  await page.goto(`/#/requests/${id}`);
  await page.getByRole("tab", { name: "Purchase order", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Supplier evaluation", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Audit trail", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve and issue order", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "On-time delivery (1-5)", exact: true }).click();
  await page.getByRole("option", { name: "5", exact: true }).click();
  const quality = page.getByRole("combobox", { name: "Quality (1-5)", exact: true });
  await quality.click();
  const qualityListId = await quality.getAttribute("aria-controls");
  await page.locator(`[id="${qualityListId}"]`).getByRole("option", { name: "4", exact: true }).click();
  const notes = page.getByLabel("Observations (optional)", { exact: true });
  await expect(notes).toHaveAttribute("maxlength", "500");
  await notes.fill("Entrega completa");
  await page.getByRole("button", { name: "Save evaluation", exact: true }).click();
  await expect(page.getByText("Evaluation saved.", { exact: true })).toBeVisible();
  expect(submitted).toEqual({ onTimeScore: 5, qualityScore: 4, observations: "Entrega completa" });
});
