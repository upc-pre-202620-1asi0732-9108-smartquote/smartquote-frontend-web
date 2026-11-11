import { test, expect } from "@playwright/test";

// Contract tests with intercepted responses: they exercise the web screens of US15–US22
// against the documented API shapes. Rules and persistence are verified by the backend suites.
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const REQUEST = uid(1), ITEM_A = uid(2), ITEM_B = uid(3), REQ_A = uid(4), REQ_B = uid(5);
const SPECIALIST = uid(10), ANALYST = uid(11), MANAGER = uid(12);
const SCENARIO = uid(20), PRICE = uid(21), DELIVERY = uid(22), RUN = uid(23);
const QUOTE_A = uid(30), QUOTE_B = uid(31), SUPPLIER = uid(40), CLARIFICATION = uid(50);
const users = {
  ProductionSpecialist: { userId: SPECIALIST, displayName: "Sara Especialista" },
  PurchaseAnalyst: { userId: ANALYST, displayName: "Ana Analista" },
  PurchaseManager: { userId: MANAGER, displayName: "Jorge Jefe" },
};
const requirement = (requirementId, name) => ({
  requirementId, name, operator: "GreaterThanOrEqual", expectedValue: "20", unitOfMeasure: "%", isMandatory: true,
});
const baseRequest = {
  requestId: REQUEST, requesterId: SPECIALIST, status: "Evaluation", version: 4, priority: "Normal",
  requiredDate: "2026-12-25", createdAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-05T12:00:00Z",
  nextResponsibleArea: "Purchasing", attachments: [], assignedAnalystId: null, technicalRevision: 0,
  items: [
    { itemId: ITEM_A, lineNumber: 1, description: "Alimento de crecimiento", quantity: 1000, unitOfMeasure: "kg", requirements: [requirement(REQ_A, "Proteína cruda")] },
    { itemId: ITEM_B, lineNumber: 2, description: "Vacuna Newcastle", quantity: 50, unitOfMeasure: "frasco", requirements: [requirement(REQ_B, "Dosis")] },
  ],
};
const quote = (quotationId, name, price) => ({
  quotationId, status: "Verified", version: 2, supplierBusinessName: name, supplierTaxIdentifier: "20123456789",
  fileName: name + ".pdf", currency: "PEN", commercialStatus: "Current", isCurrent: true, fields: [],
  lines: [{ lineId: quotationId, quantity: 1000, unitPrice: price, description: "Alimento" }],
});
const scenario = {
  scenarioId: SCENARIO, requestId: REQUEST, version: 1, status: "Active", createdBy: MANAGER, createdAt: "2026-11-05T12:00:00Z",
  criteria: [
    { criterionId: uid(24), name: "Proteína", targetField: REQ_A, category: "TechnicalCompliance", mode: "Mandatory", operator: "GreaterThanOrEqual", expectedValue: "20", unitOfMeasure: "%", weight: 0, displayOrder: 0 },
    { criterionId: PRICE, name: "Total price", targetField: "totalPrice", category: "Price", mode: "Weighted", operator: "LessThanOrEqual", expectedValue: "999999999", unitOfMeasure: "", weight: 60, displayOrder: 1 },
    { criterionId: DELIVERY, name: "Delivery lead time", targetField: "deliveryLeadTimeDays", category: "DeliveryTime", mode: "Weighted", operator: "LessThanOrEqual", expectedValue: "365", unitOfMeasure: "days", weight: 40, displayOrder: 2 },
  ],
};
const allocation = (requestedItemId, quotationId, name, amountPen) => ({
  requestedItemId, quotationId, quotationLineId: quotationId, supplierAccountId: quotationId, supplierEligibilityVersion: 2,
  supplierBusinessName: name, supplierTaxIdentifier: "20123456789", description: requestedItemId === ITEM_A ? "Alimento de crecimiento" : "Vacuna Newcastle",
  quantity: 10, unitOfMeasure: "kg", originalCurrency: "PEN", originalUnitPrice: amountPen / 10, originalTotal: amountPen,
  unitPricePen: amountPen / 10, amountPen, score: 0.9, deliveryLeadTimeDays: 3,
});
const distributedRun = {
  simulationRunId: RUN, scenarioId: SCENARIO, criteriaVersion: 1, inputFingerprint: "fp-1", executedAt: "2026-11-06T12:00:00Z",
  isCurrent: true, recommendation: null, exchangeRate: null, evaluations: [], mode: "DistributedByItem",
  distribution: {
    canApprove: true, uncoveredItemIds: [], totalPen: 4300,
    allocations: [allocation(ITEM_A, QUOTE_A, "Avícola Norte", 3000), allocation(ITEM_B, QUOTE_B, "Sanidad Sur", 1300)],
    candidates: [{ itemId: ITEM_B, quotationId: QUOTE_A, lineId: null, isEligible: false, score: 0, exclusions: ["La oferta no cubre toda la cantidad."] }],
  },
};
const configuration = (id, price, winner) => ({
  id, weights: [{ criterionId: PRICE, weight: price }, { criterionId: DELIVERY, weight: 100 - price }],
  results: [{ quotationId: QUOTE_A, isEligible: true, score: 0.8, exclusions: [] }, { quotationId: QUOTE_B, isEligible: true, score: 0.7, exclusions: [] }],
  tiedWinnerIds: [winner], recommendedQuotationId: winner,
});

async function start(page, role) {
  const state = {
    request: { ...baseRequest }, budget: null, runs: [], supplierStatus: "Pending", schedules: [],
    clarification: null, alertRead: false, sent: {},
  };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const supplier = () => ({
    id: SUPPLIER, taxIdentifier: "20123456789", businessName: "Avícola Norte", status: state.supplierStatus,
    version: state.supplierStatus === "Pending" ? 1 : 2, createdAt: "2026-11-01T12:00:00Z",
    history: state.supplierStatus === "Pending" ? [] : [{ id: uid(41), previousStatus: "Pending", newStatus: "Enabled", decidedBy: MANAGER, decidedAt: "2026-11-06T12:00:00Z", reason: state.sent.decision.reason, version: 2 }],
  });
  const budget = () => state.budget
    ? { requestId: REQUEST, status: "Configured", amountPen: state.budget, version: 1, revisions: [{ id: uid(60), version: 1, amountPen: state.budget, authorizedBy: MANAGER, authorizedAt: "2026-11-06T12:00:00Z", reason: "Límite" }] }
    : { requestId: REQUEST, status: "NotConfigured", amountPen: null, version: null, revisions: [] };
  await page.route("**/api/v1/**", (route) => {
    const call = route.request(), path = new URL(call.url()).pathname.replace(/^.*\/api\/v1/, ""), method = call.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const body = () => call.postDataJSON();
    if (path === "/iam/auth/login") return json({ accessToken: "ui-contract-test-token", expiresIn: 3600, user: { ...users[role], roles: [role] } });
    if (path === "/iam/auth/refresh") return json({}, 401);
    if (path === "/iam/users") return json([{ userId: ANALYST, displayName: "Ana Analista", email: "ana@example.test", isActive: true, roles: ["PurchaseAnalyst"] }]);
    if (path === "/purchase-requests") return json({ items: [state.request], totalItems: 1, page: 1, pageSize: 12 });
    if (path === `/purchase-requests/${REQUEST}`) return json(state.request);
    if (path.endsWith("/history")) return json({ entries: [] });
    if (path.endsWith("/quotations")) return json([quote(QUOTE_A, "Avícola Norte", 3), quote(QUOTE_B, "Sanidad Sur", 3.2)]);
    if (path.endsWith("/evaluation-scenario") || path === `/evaluation-scenarios/${SCENARIO}`) return json(scenario);
    if (path.endsWith("/simulations") && method === "GET") return json(state.runs);
    if (path === `/simulations/${RUN}`) return json(distributedRun);
    if (path.endsWith("/distributed-simulations")) { state.runs = [distributedRun]; return json(distributedRun, 201); }
    if (path.endsWith("/purchase-award-budget-check")) return json({ simulationRunId: RUN, mode: "DistributedByItem", inputFingerprint: "fp-1", exchangeRate: null,
      assessment: { status: "WithinBudget", budgetVersion: 1, budgetAmountPen: state.budget, totalPen: 4300, marginPen: state.budget - 4300, excessPen: 0, canApprove: true } });
    if (path.endsWith("/budget")) { if (method === "PUT") { state.sent.budget = body(); state.budget = body().amount; } return json(budget()); }
    if (path.endsWith("/assignment-history")) return json(state.request.assignedAnalystId ? [{ id: uid(61), previousAnalystId: null, analystId: ANALYST, assignedBy: MANAGER, assignedAt: "2026-11-06T12:00:00Z", reason: null }] : []);
    if (path.endsWith("/assignment")) { state.sent.assignment = body(); state.request = { ...state.request, assignedAnalystId: body().analystId, version: 5 }; return json(state.request); }
    if (path.endsWith("/requirement-revisions")) return json([]);
    if (path.endsWith(`/purchase-requests/${REQUEST}/clarifications`)) {
      if (method === "POST") { state.sent.clarification = body(); state.clarification = { id: CLARIFICATION, requestId: REQUEST, itemId: body().itemId, requirementId: body().requirementId, authorId: ANALYST, specialistId: SPECIALIST, question: body().question, status: "Pending", createdAt: "2026-11-06T12:00:00Z", noticeReadAt: null, answer: null, answeredBy: null, answeredAt: null, sourceTechnicalRevision: 0, version: 1 }; return json(state.clarification, 201); }
      return json(state.clarification ? [state.clarification] : []);
    }
    if (path === "/technical-clarifications") return json(state.clarification ? [state.clarification] : []);
    if (path.endsWith("/response")) { state.sent.answer = body(); state.clarification = { ...state.clarification, status: "Answered", answer: body().answer, answeredBy: SPECIALIST, answeredAt: "2026-11-06T13:00:00Z", version: 2 }; return json(state.clarification); }
    if (path.endsWith("/sensitivity-analyses")) {
      if (method === "GET") return json([]);
      state.sent.sensitivity = body();
      return json({ isCurrent: true, isStable: false, scope: "", analysis: { id: uid(70), scenarioId: SCENARIO, requestId: REQUEST, criteriaVersion: 1, createdAt: "2026-11-06T12:00:00Z",
        inputs: { baselineConfigurationId: uid(71) }, exchangeRate: null,
        configurations: [configuration(uid(71), 60, QUOTE_A), ...body().configurations.map((c, i) => configuration(uid(72 + i), c.weights[0].weight, c.weights[0].weight < 50 ? QUOTE_B : QUOTE_A))] } }, 201);
    }
    if (path === "/suppliers") return json([supplier()]);
    if (path === `/suppliers/${SUPPLIER}`) return json(supplier());
    if (path === `/suppliers/${SUPPLIER}/enable`) { state.sent.decision = body(); state.supplierStatus = "Enabled"; return json(supplier()); }
    if (path === "/recurring-request-schedules") {
      if (method === "POST") { state.sent.schedule = body(); state.schedules = [{ ...body(), id: uid(80), ownerId: SPECIALIST, isActive: true, nextOccurrenceDate: body().startDate, nextOccurrenceAt: "2026-12-01T05:00:00Z", createdAt: "2026-11-06T12:00:00Z", pausedAt: null, version: 1, occurrences: [] }]; return json(state.schedules[0], 201); }
      return json(state.schedules);
    }
    if (path === "/quotation-expiry-alerts") return json([{ id: uid(90), quotationId: QUOTE_A, requestId: REQUEST, recipientId: ANALYST, supplierName: "Avícola Norte", validUntil: "2099-01-01", leadDays: 3, createdAt: "2026-11-06T12:00:00Z", readAt: state.alertRead ? "2026-11-06T13:00:00Z" : null, reassignedAt: null }]);
    if (path === `/quotation-expiry-alerts/${uid(90)}/read`) { state.alertRead = true; return route.fulfill({ status: 204 }); }
    return json({}, 404);
  });
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill("user@example.test");
  await page.getByLabel("Password", { exact: true }).fill("contract-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  return { state, errors };
}

test("US18 E1 — manager enables a pending supplier with a reason and sees the decision history", async ({ page }) => {
  const { state, errors } = await start(page, "PurchaseManager");
  await page.getByRole("link", { name: "Supplier enablement" }).click();
  await page.getByRole("button", { name: "Avícola Norte", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Enable supplier", exact: true })).toBeVisible();
  await page.getByLabel("Reason", { exact: true }).fill("Identidad y condiciones revisadas.");
  await page.getByRole("button", { name: "Enable supplier", exact: true }).click();
  await expect(page.getByText("Decision saved.", { exact: true })).toBeVisible();
  expect(state.sent.decision).toEqual({ reason: "Identidad y condiciones revisadas.", expectedVersion: 1 });
  await expect(page.getByRole("heading", { name: "Suspend supplier", exact: true })).toBeVisible();
  await expect(page.getByText("Identidad y condiciones revisadas.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("US22 E1 US20 E1 US19 E1 E2 US21 E1 E3 — manager assigns, budgets, analyzes sensitivity and reviews a distributed award", async ({ page }) => {
  const { state, errors } = await start(page, "PurchaseManager");
  await page.goto(`/#/requests/${REQUEST}`);
  // US22: first assignment, without a reason.
  await page.getByRole("combobox", { name: "Assign to", exact: true }).click();
  await page.getByRole("option", { name: /Ana Analista/ }).click();
  await page.getByRole("button", { name: "Assign request", exact: true }).click();
  await expect(page.getByText("Responsible analyst saved.", { exact: true })).toBeVisible();
  expect(state.sent.assignment).toEqual({ analystId: ANALYST, reason: null, expectedVersion: 4 });
  await expect(page.getByRole("button", { name: "Reassign request", exact: true })).toBeVisible();
  // US20: an absent budget is not zero; the first authorization expects version 0.
  await page.getByRole("tab", { name: "Purchase order", exact: true }).click();
  await expect(page.getByText(/This is not a budget of zero/)).toBeVisible();
  await page.getByLabel("Maximum amount (PEN)", { exact: true }).fill("5000");
  await page.getByRole("textbox", { name: "Reason", exact: true }).fill("Límite autorizado");
  await page.getByRole("button", { name: "Authorize budget", exact: true }).click();
  await expect(page.getByText("Budget saved.", { exact: true })).toBeVisible();
  expect(state.sent.budget).toEqual({ amount: 5000, currency: "PEN", reason: "Límite autorizado", expectedVersion: 0 });
  // US19: variations change only the commercial weights and always total 100.
  await page.getByRole("tab", { name: "Comparison", exact: true }).click();
  await page.getByRole("button", { name: "Analyze sensitivity", exact: true }).click();
  await expect(page.getByText("Sensitivity analysis completed.", { exact: true })).toBeVisible();
  for (const variant of state.sent.sensitivity.configurations)
    expect(variant.weights.reduce((sum, w) => sum + w.weight, 0)).toBe(100);
  await expect(page.getByText(/The recommended supplier changes in 2 configuration/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "Changes", exact: true })).toHaveCount(2);
  // US21: one supplier per item, exclusions explained, global budget contrast.
  await page.getByRole("button", { name: "Simulate distributed purchase", exact: true }).click();
  await expect(page.getByText("Combination by item", { exact: true })).toBeVisible();
  await expect(page.getByText("La oferta no cubre toda la cantidad.")).toBeAttached();
  await page.getByRole("button", { name: "Review purchase order", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Distributed award", exact: true })).toBeVisible();
  await expect(page.getByText("Within budget", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve distributed award", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("US17 E1 E2 US15 E1 — analyst reads an expiry alert and requests a clarification", async ({ page }) => {
  const { state, errors } = await start(page, "PurchaseAnalyst");
  await page.getByRole("link", { name: "Expiry alerts" }).click();
  await expect(page.getByRole("button", { name: /Avícola Norte/ })).toBeVisible();
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.getByText("Read", { exact: true })).toBeVisible();
  await page.goto(`/#/requests/${REQUEST}?tab=clarifications`);
  await page.getByRole("combobox", { name: "Item", exact: true }).click();
  await page.getByRole("option", { name: "Alimento de crecimiento", exact: true }).click();
  await page.getByRole("combobox", { name: "Requirement", exact: true }).click();
  await page.getByRole("option", { name: "Proteína cruda", exact: true }).click();
  await page.getByLabel("Question", { exact: true }).fill("¿El mínimo es proteína cruda?");
  await page.getByRole("button", { name: "Send clarification", exact: true }).click();
  await expect(page.getByText("Clarification sent to the specialist.", { exact: true })).toBeVisible();
  expect(state.sent.clarification).toEqual({ itemId: ITEM_A, requirementId: REQ_A, specialistId: SPECIALIST, question: "¿El mínimo es proteína cruda?", expectedVersion: 4 });
  await expect(page.getByText("Waiting for the specialist's answer.", { exact: true })).toBeVisible();
  // Analysts cannot authorize budgets or see manager-only analysis.
  await page.getByRole("tab", { name: "Comparison", exact: true }).click();
  await expect(page.getByRole("button", { name: "Analyze sensitivity", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("US16 E1 US15 E2 — specialist registers a recurring schedule and answers a clarification", async ({ page }) => {
  const { state, errors } = await start(page, "ProductionSpecialist");
  await page.getByRole("link", { name: "Recurring requests" }).click();
  await page.getByRole("button", { name: "New schedule", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("Alimento de crecimiento");
  await page.getByLabel("Unit", { exact: true }).first().fill("kg");
  await page.getByLabel("Requirement name", { exact: true }).fill("Proteína cruda");
  await page.getByLabel("Expected value", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save schedule", exact: true }).click();
  await expect(page.getByText("Schedule saved.", { exact: true })).toBeVisible();
  expect(state.sent.schedule).toMatchObject({ intervalDays: 7, requiredDateOffsetDays: 2, timeZoneId: "America/Lima", priority: "Normal" });
  expect(state.sent.schedule.items[0].requirements[0]).toMatchObject({ name: "Proteína cruda", isMandatory: true });
  await expect(page.getByRole("heading", { name: "Alimento de crecimiento", exact: true })).toBeVisible();
  // US15: the answer is given in the context of the request that originated the question.
  state.clarification = { id: CLARIFICATION, requestId: REQUEST, itemId: ITEM_A, requirementId: REQ_A, authorId: ANALYST, specialistId: SPECIALIST, question: "¿El mínimo es proteína cruda?", status: "Pending", createdAt: "2026-11-06T12:00:00Z", noticeReadAt: null, answer: null, sourceTechnicalRevision: 0, version: 1 };
  await page.getByRole("link", { name: "Clarifications" }).click();
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await page.getByRole("textbox", { name: "Answer", exact: true }).fill("Sí, 21 % de proteína cruda.");
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(page.getByText("Answer saved.", { exact: true })).toBeVisible();
  expect(state.sent.answer).toEqual({ answer: "Sí, 21 % de proteína cruda.", expectedVersion: 1 });
  await expect(page.getByRole("button", { name: "Change the requirement", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
