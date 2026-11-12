import test from "node:test";
import assert from "node:assert/strict";
import { PurchaseRequest } from "../../src/supply-requests/domain/purchase-request.entity.js";
import { Clarification } from "../../src/supply-requests/domain/request-collaboration.entity.js";
import { RequestCollaborationService } from "../../src/supply-requests/application/request-collaboration.service.js";
import { HttpRequestCollaborationRepository } from "../../src/supply-requests/infrastructure/http-request-collaboration.repository.js";
import { RecurringScheduleService } from "../../src/supply-requests/application/recurring-schedule.service.js";
import { PurchaseRequestService } from "../../src/supply-requests/application/purchase-request.service.js";
import { HttpPurchaseRequestRepository } from "../../src/supply-requests/infrastructure/http-purchase-request.repository.js";
import { ExpiryAlert } from "../../src/quotation-intake/domain/expiry-alert.entity.js";
import { Quotation } from "../../src/quotation-intake/domain/quotation.entity.js";
import { HttpQuotationRepository } from "../../src/quotation-intake/infrastructure/http-quotation.repository.js";
import { SupplierAccount } from "../../src/purchase-ordering/domain/supplier-account.entity.js";
import {
  PurchaseBudgetService,
  SupplierEligibilityService,
} from "../../src/purchase-ordering/application/ordering-policy.service.js";
import { BudgetCheck, PurchaseBudget } from "../../src/purchase-ordering/domain/purchase-budget.entity.js";
import { PurchaseOrderService } from "../../src/purchase-ordering/application/purchase-order.service.js";
import { PurchaseAwardService } from "../../src/purchase-ordering/application/purchase-award.service.js";
import { PurchaseAward } from "../../src/purchase-ordering/domain/purchase-award.entity.js";
import {
  HttpPurchaseAwardRepository,
  HttpPurchaseBudgetRepository,
} from "../../src/purchase-ordering/infrastructure/http-ordering-policy.repository.js";
import { HttpPurchaseOrderRepository } from "../../src/purchase-ordering/infrastructure/http-purchase-order.repository.js";
import { EvaluationService } from "../../src/evaluation-simulation/application/evaluation.service.js";
import { SensitivityAnalysis, buildVariants } from "../../src/evaluation-simulation/domain/sensitivity.entity.js";
import { Simulation } from "../../src/evaluation-simulation/domain/simulation.entity.js";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const REQUEST = id(1), ITEM = id(2), REQUIREMENT = id(3), SPECIALIST = id(4), ANALYST = id(5), OTHER = id(6);
const request = (extra = {}) => new PurchaseRequest({
  requestId: REQUEST, requesterId: SPECIALIST, status: "Evaluation", version: 3, technicalRevision: 0,
  items: [
    { itemId: ITEM, description: "Alimento", quantity: 10, unitOfMeasure: "kg",
      requirements: [{ requirementId: REQUIREMENT, name: "Proteína", operator: "GreaterThanOrEqual", expectedValue: "20", unitOfMeasure: "%", isMandatory: true }] },
    { itemId: id(7), description: "Vacuna", quantity: 5, unitOfMeasure: "frasco", requirements: [] },
  ],
  ...extra,
});
// Records every HTTP call so the contract can be compared with the API documentation.
const recorder = (response = {}) => {
  const calls = [];
  return { calls, request: async (path, init = {}) => { calls.push({ path, init, body: init.body ? JSON.parse(init.body) : undefined }); return typeof response === "function" ? response(path) : response; } };
};
const criteria = [
  { criterionId: id(10), mode: "Mandatory", category: "TechnicalCompliance", weight: 0 },
  { criterionId: id(11), mode: "Weighted", category: "Price", weight: 60 },
  { criterionId: id(12), mode: "Weighted", category: "DeliveryTime", weight: 40 },
];

// Los dobles validan reglas y contrato del cliente; la autoridad sigue siendo la API.

test("US15 E1 — a clarification needs an item, one of its requirements and a question, and goes to the requester", async () => {
  const http = recorder({ id: id(20), status: "Pending" });
  const service = new RequestCollaborationService(new HttpRequestCollaborationRepository(http));
  await assert.rejects(async () => service.ask(request(), { itemId: ITEM, requirementId: OTHER, question: "¿?" }), { code: "clarificationTarget" });
  await assert.rejects(async () => service.ask(request(), { itemId: ITEM, requirementId: REQUIREMENT, question: "  " }), { code: "clarificationText" });
  assert.equal(http.calls.length, 0);
  const created = await service.ask(request(), { itemId: ITEM, requirementId: REQUIREMENT, question: " ¿Proteína cruda? " });
  assert.equal(http.calls[0].path, `/purchase-requests/${REQUEST}/clarifications`);
  assert.deepEqual(http.calls[0].body, { itemId: ITEM, requirementId: REQUIREMENT, specialistId: SPECIALIST, question: "¿Proteína cruda?", expectedVersion: 3 });
  assert.equal(created.pending, true);
});

test("US15 E2 — only the recipient can answer a pending clarification, with its current version", async () => {
  const pending = new Clarification({ id: id(20), status: "Pending", specialistId: SPECIALIST, version: 2 });
  assert.equal(pending.canBeAnsweredBy(SPECIALIST), true);
  assert.equal(pending.canBeAnsweredBy(ANALYST), false);
  assert.equal(new Clarification({ status: "Answered", specialistId: SPECIALIST }).canBeAnsweredBy(SPECIALIST), false);
  const http = recorder({ id: id(20), status: "Answered" });
  const service = new RequestCollaborationService(new HttpRequestCollaborationRepository(http));
  await assert.rejects(async () => service.respond(pending, ""), { code: "clarificationText" });
  assert.equal((await service.respond(pending, " Sí, 21 % ")).answered, true);
  assert.equal(http.calls[0].path, `/technical-clarifications/${id(20)}/response`);
  assert.deepEqual(http.calls[0].body, { answer: "Sí, 21 %", expectedVersion: 2 });
});

test("US15 E3 — a requirement revision needs an answered, current clarification, a complete specification and a reason", async () => {
  const answered = new Clarification({ id: id(20), itemId: ITEM, requirementId: REQUIREMENT, status: "Answered", specialistId: SPECIALIST, sourceTechnicalRevision: 0, version: 3 });
  assert.equal(answered.canBeRevisedBy(SPECIALIST, request()), true);
  assert.equal(answered.canBeRevisedBy(ANALYST, request()), false);
  // Another revision already changed the specification: a new clarification is required.
  assert.equal(answered.canBeRevisedBy(SPECIALIST, request({ technicalRevision: 1 })), false);
  const http = recorder({});
  const service = new RequestCollaborationService(new HttpRequestCollaborationRepository(http));
  const specification = { name: "Proteína mínima", operator: "GreaterThanOrEqual", expectedValue: "21", unitOfMeasure: "%", isMandatory: true };
  await assert.rejects(async () => service.revise(answered, request(), { ...specification, expectedValue: " " }, "Confirmado"), { code: "invalidRequirement" });
  await assert.rejects(async () => service.revise(answered, request(), specification, ""), { code: "reasonRequired" });
  // The backend rejects a revision identical to the current specification.
  const current = { name: "Proteína", operator: "GreaterThanOrEqual", expectedValue: "20", unitOfMeasure: "%", isMandatory: true };
  await assert.rejects(async () => service.revise(answered, request(), current, "Sin cambios"), { code: "unchangedRequirement" });
  await service.revise(answered, request(), specification, " Confirmado ");
  assert.equal(http.calls[0].path, `/technical-clarifications/${id(20)}/requirement-revisions`);
  assert.deepEqual(http.calls[0].body, { specification, reason: "Confirmado", expectedClarificationVersion: 3, expectedRequestVersion: 3 });
});

const schedule = (extra = {}) => ({
  startDate: "2026-11-10", intervalDays: 7, requiredDateOffsetDays: 2, timeZoneId: "America/Lima", priority: "Normal",
  items: [{ description: "Alimento", quantity: 1000, unitOfMeasure: "kg",
    requirements: [{ name: "Proteína", operator: "GreaterThanOrEqual", expectedValue: "20", unitOfMeasure: "%", isMandatory: true }] }],
  ...extra,
});

test("US16 E1 — a schedule needs a current start date, a positive interval, a valid lead time and complete items", async () => {
  let sent;
  const service = new RecurringScheduleService({ create: async (payload) => { sent = payload; return payload; } }, () => "2026-11-10");
  await assert.rejects(async () => service.create(schedule({ startDate: "2026-11-09" })), { code: "scheduleStart" });
  for (const intervalDays of [0, -1, 1.5, 3651])
    await assert.rejects(async () => service.create(schedule({ intervalDays })), { code: "scheduleInterval" });
  await assert.rejects(async () => service.create(schedule({ requiredDateOffsetDays: -1 })), { code: "scheduleOffset" });
  await assert.rejects(async () => service.create(schedule({ timeZoneId: " " })), { code: "scheduleTimeZone" });
  await assert.rejects(async () => service.create(schedule({ items: [] })), { code: "itemRequired" });
  assert.equal(sent, undefined);
  await service.create(schedule({ requiredDateOffsetDays: 0 }));
  assert.deepEqual(Object.keys(sent), ["startDate", "intervalDays", "requiredDateOffsetDays", "timeZoneId", "priority", "items"]);
});

test("US16 E2 E3 — a generated draft is edited and sent only by confirmation, with its version", async () => {
  const http = recorder({ requestId: REQUEST, status: "Submitted", items: [] });
  const service = new PurchaseRequestService(new HttpPurchaseRequestRepository(http));
  const draft = request({ status: "Draft", version: 2 });
  assert.equal(draft.isDraft, true);
  assert.equal(draft.isActive, false);
  await assert.rejects(async () => service.submitDraft(request()), { code: "draftOnly" });
  await assert.rejects(async () => service.editDraft(draft, { requiredDate: "2026-11-20", priority: "Normal", items: [] }), { code: "itemRequired" });
  assert.equal(http.calls.length, 0);
  await service.editDraft(draft, { requiredDate: "2026-11-20", priority: "High", items: schedule().items });
  assert.equal(http.calls[0].path, `/purchase-requests/${REQUEST}/draft`);
  assert.equal(http.calls[0].init.method, "PUT");
  assert.equal(http.calls[0].body.expectedVersion, 2);
  await service.submitDraft(draft);
  assert.equal(http.calls[1].path, `/purchase-requests/${REQUEST}/submit`);
  assert.deepEqual(http.calls[1].body, { expectedVersion: 2 });
});

test("US16 E4 — pausing sends the version of the schedule, not of a request", async () => {
  const calls = [];
  const service = new RecurringScheduleService({ pause: async (value) => { calls.push(value); return { ...value, isActive: false }; } });
  assert.equal((await service.pause({ id: id(30), version: 4, isActive: true })).isActive, false);
  assert.equal(calls[0].version, 4);
});

test("US17 E1 E2 — alerts are read from the analyst inbox and marking one as read is a separate, idempotent call", async () => {
  const http = recorder([{ id: id(40), quotationId: id(41), requestId: REQUEST, supplierName: "Avícola", validUntil: "2026-11-12", leadDays: 3, readAt: null }]);
  const repository = new HttpQuotationRepository(http);
  const [alert] = await repository.expiryAlerts(true);
  assert.equal(http.calls[0].path, "/quotation-expiry-alerts?unreadOnly=true&page=1&pageSize=100");
  assert.equal(alert.supplierName, "Avícola");
  await repository.readExpiryAlert(alert.id);
  assert.deepEqual([http.calls[1].path, http.calls[1].init.method], [`/quotation-expiry-alerts/${id(40)}/read`, "PUT"]);
});

test("US17 E3 — an offer is current during its last day and expired from the next one", () => {
  const alert = (validUntil) => new ExpiryAlert({ validUntil }, "2026-11-10");
  assert.equal(alert("2026-11-12").daysLeft, 2);
  assert.deepEqual([alert("2026-11-10").daysLeft, alert("2026-11-10").expired], [0, false]);
  assert.equal(alert("2026-11-09").expired, true);
  assert.equal(alert("2026-12-01").daysLeft, 21);
  assert.equal(new Quotation({ commercialStatus: "Expired" }).expired, true);
  assert.equal(new Quotation({ commercialStatus: "Current" }).expired, false);
});

test("US18 E1 E2 E4 — each supplier status allows one decision and every decision needs a reason", async () => {
  const sent = [];
  const service = new SupplierEligibilityService({ decide: async (supplier, action, reason) => { sent.push([action, reason, supplier.version]); } });
  const supplier = (status) => new SupplierAccount({ id: id(50), status, version: 2 });
  assert.deepEqual(supplier("Pending").nextActions, ["enable"]);
  assert.deepEqual(supplier("Enabled").nextActions, ["suspend"]);
  assert.deepEqual(supplier("Suspended").nextActions, ["reactivate"]);
  await assert.rejects(async () => service.decide(supplier("Pending"), "suspend", "Motivo"), { code: "supplierTransition" });
  await assert.rejects(async () => service.decide(supplier("Suspended"), "enable", "Motivo"), { code: "supplierTransition" });
  await assert.rejects(async () => service.decide(supplier("Enabled"), "suspend", "  "), { code: "reasonRequired" });
  assert.equal(sent.length, 0);
  await service.decide(supplier("Suspended"), "reactivate", " Revisado ");
  assert.deepEqual(sent[0], ["reactivate", "Revisado", 2]);
});

test("US18 E3 — only an enabled supplier is presented as available for new purchases", () => {
  assert.equal(new SupplierAccount({ status: "Enabled" }).enabled, true);
  assert.equal(new SupplierAccount({ status: "Pending" }).enabled, false);
  assert.equal(new SupplierAccount({ status: "Suspended" }).enabled, false);
});

test("US19 E1 — variants move price against delivery time, keep other weights and always total 100", () => {
  const withTechnical = [...criteria, { criterionId: id(13), mode: "Weighted", category: "TechnicalCompliance", weight: 0 }];
  const variants = buildVariants(withTechnical, [20, 80]);
  assert.deepEqual(variants[0].weights, [
    { criterionId: id(11), weight: 20 }, { criterionId: id(12), weight: 80 }, { criterionId: id(13), weight: 0 },
  ]);
  for (const variant of variants) assert.equal(variant.weights.reduce((sum, w) => sum + w.weight, 0), 100);
  // Mandatory rules are never part of a variation.
  assert.equal(variants.some((v) => v.weights.some((w) => w.criterionId === id(10))), false);
});

test("US19 E2 — the comparison marks where the recommended supplier changes against the baseline", () => {
  const analysis = new SensitivityAnalysis({ isCurrent: true, isStable: false, scope: "", analysis: {
    id: id(60), criteriaVersion: 2, inputs: { baselineConfigurationId: "b" },
    configurations: [
      { id: "v1", recommendedQuotationId: "q2" }, { id: "b", recommendedQuotationId: "q1" }, { id: "v2", recommendedQuotationId: "q1" },
    ] } });
  assert.equal(analysis.baseline.id, "b");
  // The baseline is listed first and variations are numbered from 1.
  assert.deepEqual(analysis.comparison.map((c) => [c.id, c.isBaseline, c.changesRecommendation, c.variantNumber]),
    [["b", true, false, 0], ["v1", false, true, 1], ["v2", false, false, 2]]);
  // Weights are read with the criteria of the analyzed version.
  const v1 = { weights: [{ criterionId: "p1", weight: 20 }, { criterionId: "d1", weight: 80 }] };
  const analyzed = [{ criterionId: "p1", mode: "Weighted", category: "Price" }, { criterionId: "d1", mode: "Weighted", category: "DeliveryTime" }];
  assert.deepEqual([analysis.weightFor(v1, "Price", analyzed), analysis.weightFor(v1, "DeliveryTime", analyzed)], [20, 80]);
  assert.equal(analysis.weightFor(v1, "Price", []), undefined);
  assert.equal(analysis.changedCount, 1);
});

test("US19 E3 — invalid variations or unsaved criteria are rejected before calling the API", async () => {
  let calls = 0;
  const service = new EvaluationService({ createSensitivity: async () => { calls++; } });
  const scenario = { scenarioId: id(61), status: "Active", criteria };
  for (const weights of [[], [60], [20, 20], [101], [-5], Array.from({ length: 21 }, (_, i) => i)])
    await assert.rejects(async () => service.analyzeSensitivity(scenario, weights), { code: "sensitivityVariants" });
  await assert.rejects(async () => service.analyzeSensitivity(null, [20]), { code: "scenarioRequired" });
  await assert.rejects(async () => service.analyzeSensitivity({ ...scenario, status: "Superseded" }, [20]), { code: "scenarioRequired" });
  await assert.rejects(async () => service.analyzeSensitivity({ ...scenario, criteria: criteria.map((c) => ({ ...c, criterionId: undefined })) }, [20]), { code: "scenarioRequired" });
  assert.equal(calls, 0);
});

test("US19 E4 — a configuration is promoted to an official simulation only from a current analysis", async () => {
  const promoted = [];
  const service = new EvaluationService({
    promoteSensitivity: async (...args) => { promoted.push(args); return { scenarioId: "s2", simulationRunId: "r2" }; },
    get: async (value) => ({ scenarioId: value }), simulation: async (value) => ({ simulationRunId: value }),
  });
  const analysis = (isCurrent) => new SensitivityAnalysis({ isCurrent, analysis: { id: id(60), criteriaVersion: 2, configurations: [{ id: "v1" }] } });
  await assert.rejects(async () => service.promoteSensitivity(analysis(false), "v1"), { code: "staleAnalysis" });
  await assert.rejects(async () => service.promoteSensitivity(analysis(true), "unknown"), { code: "sensitivityVariants" });
  assert.equal(promoted.length, 0);
  assert.deepEqual(await service.promoteSensitivity(analysis(true), "v1"), { scenario: { scenarioId: "s2" }, simulation: { simulationRunId: "r2" } });
  assert.deepEqual(promoted[0], [id(60), "v1", 2]);
});

test("US20 E1 — a budget needs a positive PEN amount with up to four decimals and a reason; the first version expects 0", async () => {
  const http = recorder({ requestId: REQUEST, status: "Configured", amountPen: 5000, version: 1, revisions: [] });
  const service = new PurchaseBudgetService(new HttpPurchaseBudgetRepository(http));
  const none = new PurchaseBudget({ status: "NotConfigured", amountPen: null, version: null });
  // An absent budget is never interpreted as a budget of zero.
  assert.deepEqual([none.configured, none.expectedVersion], [false, 0]);
  for (const amount of [0, -1, NaN, null, 1.23456])
    await assert.rejects(async () => service.authorize(request(), none, amount, "Límite"), { code: "budgetAmount" });
  await assert.rejects(async () => service.authorize(request(), none, 5000, " "), { code: "reasonRequired" });
  await assert.rejects(async () => service.authorize(request({ status: "Ordered" }), none, 5000, "Límite"), { code: "budgetInactive" });
  assert.equal(http.calls.length, 0);
  const saved = await service.authorize(request(), none, 5000.1234, " Límite ");
  assert.deepEqual(http.calls[0].body, { amount: 5000.1234, currency: "PEN", reason: "Límite", expectedVersion: 0 });
  assert.equal(saved.configured, true);
  await service.authorize(request(), saved, 6000, "Nuevo límite");
  assert.equal(http.calls[1].body.expectedVersion, 1);
});

const run = (extra = {}) => new Simulation({ simulationRunId: id(70), scenarioId: id(71), isCurrent: true,
  evaluations: [{ quotationId: "q1", isEligible: true }], ...extra });
const evaluations = (simulation) => ({ currentSimulation: async () => simulation });
const check = (assessment) => new BudgetCheck({ inputFingerprint: "fp", assessment });

test("US20 E2 E4 — an approval within the limit sends the budget version that was contrasted", async () => {
  const http = recorder({ purchaseOrderId: id(72), lines: [] });
  const service = new PurchaseOrderService(new HttpPurchaseOrderRepository(http), evaluations(run()));
  const within = check({ status: "WithinBudget", budgetVersion: 2, totalPen: 4000, marginPen: 1000, canApprove: true });
  await service.approve(REQUEST, id(70), "q1", "Horario de almacén", "Almacén", within);
  assert.deepEqual(http.calls[0].body, { deliveryConditions: "Horario de almacén", deliveryDestination: "Almacén", expectedBudgetVersion: 2 });
  // Equal to the limit is still within budget; without a budget the contrasted version is 0.
  assert.equal(check({ status: "WithinBudget", budgetVersion: 1, marginPen: 0, canApprove: true }).canApprove, true);
  assert.equal(check({ status: "NotConfigured", budgetVersion: null, canApprove: true }).budgetVersion, 0);
  // Clients that did not show a check omit the field; the API still validates the budget.
  await service.approve(REQUEST, id(70), "q1", "Horario", "Almacén");
  assert.equal("expectedBudgetVersion" in http.calls[1].body, false);
});

test("US20 E3 — an exceeded budget blocks the approval before any order is requested", async () => {
  const http = recorder({});
  const service = new PurchaseOrderService(new HttpPurchaseOrderRepository(http), evaluations(run()));
  const exceeded = check({ status: "Exceeded", budgetVersion: 2, excessPen: 250, canApprove: false });
  assert.equal(exceeded.exceeded, true);
  await assert.rejects(async () => service.approve(REQUEST, id(70), "q1", "Horario", "Almacén", exceeded), { code: "budgetExceeded" });
  assert.equal(http.calls.length, 0);
});

const distributed = (canApprove = true) => run({ mode: "DistributedByItem",
  distribution: { canApprove, uncoveredItemIds: canApprove ? [] : [ITEM], allocations: [], candidates: [], totalPen: 900 } });

test("US21 E1 — a distributed simulation needs saved criteria and more than one item", async () => {
  const calls = [];
  const service = new EvaluationService({ simulateDistributed: async (scenarioId) => { calls.push(scenarioId); return distributed(); } });
  await assert.rejects(async () => service.simulateDistributed(null, request()), { code: "scenarioRequired" });
  await assert.rejects(async () => service.simulateDistributed({ scenarioId: id(71) }, request({ items: [request().items[0]] })), { code: "distributedItems" });
  assert.equal(calls.length, 0);
  const result = await service.simulateDistributed({ scenarioId: id(71) }, request());
  assert.deepEqual([calls[0], result.distributed], [id(71), true]);
  assert.equal(run().distributed, false);
});

test("US21 E2 — an incomplete or outdated combination cannot be approved", async () => {
  const http = recorder({});
  const approvable = check({ status: "NotConfigured", canApprove: true });
  const approve = (simulation, budget = approvable) =>
    new PurchaseAwardService(new HttpPurchaseAwardRepository(http), evaluations(simulation))
      .approve(REQUEST, id(70), budget, "Horario", "Almacén", "key-1");
  await assert.rejects(async () => approve(distributed(false)), { code: "incompleteCoverage" });
  await assert.rejects(async () => approve(run()), { code: "incompleteCoverage" });
  await assert.rejects(async () => approve(distributed().reconcile(REQUEST, { scenarioId: "other", status: "Active" }, { requestId: REQUEST })), { code: "staleSimulation" });
  await assert.rejects(async () => approve(distributed(), check({ status: "Exceeded", canApprove: false })), { code: "budgetExceeded" });
  assert.equal(http.calls.length, 0);
});

test("US21 E3 E4 — the award is requested once with a stable key, the contrasted budget and fingerprint", async () => {
  const response = { award: { id: id(80), mode: "DistributedByItem", totalPen: 900, allocations: [] },
    orders: [{ purchaseOrderId: id(81), orderNumber: "OC-1", lines: [] }, { purchaseOrderId: id(82), orderNumber: "OC-2", lines: [] }] };
  const http = recorder(response);
  const service = new PurchaseAwardService(new HttpPurchaseAwardRepository(http), evaluations(distributed()));
  const budget = check({ status: "WithinBudget", budgetVersion: 3, canApprove: true });
  await assert.rejects(async () => service.approve(REQUEST, id(70), budget, "Horario", "Almacén", ""), { code: "idempotencyKey" });
  await assert.rejects(async () => service.approve(REQUEST, id(70), budget, " ", "Almacén", "key-1"), { code: "deliveryRequired" });
  const award = await service.approve(REQUEST, id(70), budget, " Horario ", " Almacén ", "key-1");
  const retry = await service.approve(REQUEST, id(70), budget, " Horario ", " Almacén ", "key-1");
  assert.equal(http.calls[0].path, `/simulations/${id(70)}/purchase-awards`);
  assert.equal(http.calls[0].init.headers["Idempotency-Key"], "key-1");
  assert.deepEqual(http.calls[0].body, { deliveryConditions: "Horario", deliveryDestination: "Almacén", expectedBudgetVersion: 3, expectedInputFingerprint: "fp" });
  // A retry repeats the same key and body, so the API returns the existing orders.
  assert.deepEqual(http.calls[1].body, http.calls[0].body);
  assert.deepEqual([award.distributed, award.orders.length, award.singleOrder], [true, 2, null]);
  assert.equal(retry.id, award.id);
  assert.equal(new PurchaseAward({ award: { mode: "SingleSupplier" }, orders: [response.orders[0]] }).singleOrder.orderNumber, "OC-1");
});

test("US22 E1 E2 — the first assignment needs an analyst; a reassignment needs another analyst and a reason", async () => {
  const http = recorder({ requestId: REQUEST, assignedAnalystId: ANALYST, items: [] });
  const service = new RequestCollaborationService(new HttpRequestCollaborationRepository(http));
  await assert.rejects(async () => service.assign(request(), null, ""), { code: "analystRequired" });
  const assigned = request({ assignedAnalystId: ANALYST });
  await assert.rejects(async () => service.assign(assigned, ANALYST, "Carga"), { code: "sameAnalyst" });
  await assert.rejects(async () => service.assign(assigned, OTHER, " "), { code: "reasonRequired" });
  assert.equal(http.calls.length, 0);
  assert.equal((await service.assign(request(), ANALYST, "")).assignedAnalystId, ANALYST);
  assert.deepEqual(http.calls[0].body, { analystId: ANALYST, reason: null, expectedVersion: 3 });
  await service.assign(assigned, OTHER, " Redistribución de carga ");
  assert.deepEqual(http.calls[1].body, { analystId: OTHER, reason: "Redistribución de carga", expectedVersion: 3 });
  assert.equal(http.calls[1].init.method, "PUT");
});

test("US22 E3 — closed or draft requests are not offered for assignment and only active analysts are listed", async () => {
  for (const status of ["Draft", "Ordered", "Rejected", "Cancelled"]) assert.equal(request({ status }).isActive, false);
  for (const status of ["Submitted", "UnderReview", "QuotationCollection", "Evaluation", "Approved"]) assert.equal(request({ status }).isActive, true);
  const http = recorder([]);
  await new HttpRequestCollaborationRepository(http).analysts();
  assert.equal(http.calls[0].path, "/iam/users?role=PurchaseAnalyst&status=Active&page=1&pageSize=100");
});

test("US22 E4 — the analyst's own queue is requested with assignedToMe and keeps the status filter", async () => {
  const http = recorder({ items: [], totalItems: 0 });
  const service = new PurchaseRequestService(new HttpPurchaseRequestRepository(http));
  await service.list("Evaluation", 2, undefined, true);
  assert.equal(http.calls[0].path, "/purchase-requests?status=Evaluation&assignedToMe=true&page=2&pageSize=12");
  await service.list("", 1);
  assert.equal(http.calls[1].path, "/purchase-requests?page=1&pageSize=12");
});
