import test from "node:test";
import assert from "node:assert/strict";
import { AuditTrailService } from "../../src/purchase-ordering/application/audit-trail.service.js";
import { SupplierPerformanceService } from "../../src/purchase-ordering/application/supplier-performance.service.js";
import { PurchaseOrder } from "../../src/purchase-ordering/domain/purchase-order.entity.js";
import { PurchaseOrderService } from "../../src/purchase-ordering/application/purchase-order.service.js";
import { HttpSupplierPerformanceRepository } from "../../src/purchase-ordering/infrastructure/http-supplier-performance.repository.js";

const ID = "4c1d2b3a-0000-4000-8000-000000000001";

// US12 E1 E2 E3: validación o contrato del cliente; los dobles no prueban persistencia.
test("US12 E1 E2 E3 — audit timeline only accepts audited entity types and well-formed identifiers", async () => {
  let calls = 0;
  const service = new AuditTrailService({ timeline: async () => { calls++; return []; } });
  await assert.rejects(service.timeline("Supplier", ID), { code: "invalidAuditEntity" });
  await assert.rejects(service.timeline("PurchaseOrder", "not-a-guid"), { code: "invalidAuditEntity" });
  assert.equal(calls, 0);
  assert.deepEqual(await service.timeline("PurchaseOrder", ID), []);
  assert.equal(calls, 1);
});

// US13 E3: validación o contrato del cliente; los dobles no prueban persistencia.
test("US13 E3 — supplier performance trims and requires an 11-digit tax identifier", async () => {
  let sent;
  const service = new SupplierPerformanceService({
    performance: async (taxId) => { sent = taxId; return { supplierTaxIdentifier: taxId }; },
  });
  await assert.rejects(service.performance("2069876543"), { code: "invalidTaxId" });
  await assert.rejects(service.performance("abc12345678"), { code: "invalidTaxId" });
  await service.performance(" 20698765432 ");
  assert.equal(sent, "20698765432");
});

// US13 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US13 E2 — delivery evaluation requires whole scores from 1 to 5 and bounded observations", () => {
  assert.doesNotThrow(() => PurchaseOrder.validateEvaluation({ onTimeScore: 5, qualityScore: 4, observations: "x".repeat(500) }));
  assert.doesNotThrow(() => PurchaseOrder.validateEvaluation({ onTimeScore: 1, qualityScore: 5, observations: "" }));
  for (const bad of [0, 6, 3.5, null]) {
    assert.throws(() => PurchaseOrder.validateEvaluation({ onTimeScore: bad, qualityScore: 4 }), { code: "invalidScore" });
  }
  assert.throws(
    () => PurchaseOrder.validateEvaluation({ onTimeScore: 4, qualityScore: 4, observations: "x".repeat(501) }),
    { code: "observationsTooLong" },
  );
});

// US13 E3: validación o contrato del cliente; los dobles no prueban persistencia.
test("US13 E3 — supplier history preserves the server summary and the individual evaluation contract", async () => {
  const response = {
    supplierTaxIdentifier: "20123456789", evaluationCount: 1,
    averageOnTimeScore: 5, averageQualityScore: 4, overallScore: 4.5,
    firstEvaluatedAt: "2026-10-05T12:00:00Z", lastEvaluatedAt: "2026-10-05T12:00:00Z",
    evaluations: [{ deliveryEvaluationId: ID, purchaseOrderId: ID, evaluatedBy: ID,
      evaluatedAt: "2026-10-05T12:00:00Z", onTimeScore: 5, qualityScore: 4,
      observations: "Entrega completa" }],
  };
  const repository = new HttpSupplierPerformanceRepository({ request: async (path) => {
    assert.equal(path, "/suppliers/20123456789/performance");
    return response;
  } });
  const performance = await repository.performance("20123456789");
  assert.deepEqual(performance.evaluations, response.evaluations);
  assert.equal(performance.overallScore, 4.5);
  assert.equal(performance.lastEvaluatedAt, response.lastEvaluatedAt);
});

// US13 E3: validación o contrato del cliente; los dobles no prueban persistencia.
test("US13 E3 — missing history from an older API is not presented as an empty history", async () => {
  const repository = new HttpSupplierPerformanceRepository({ request: async () => ({ evaluationCount: 2 }) });
  assert.equal((await repository.performance("20123456789")).evaluations, null);
});

// US13 E1 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US13 E1 E2 — order service validates the evaluation before calling the repository", async () => {
  let calls = 0;
  const service = new PurchaseOrderService(
    { evaluateDelivery: async () => { calls++; } },
    {},
  );
  await assert.rejects(service.evaluateDelivery(ID, { onTimeScore: 9, qualityScore: 4 }), { code: "invalidScore" });
  assert.equal(calls, 0);
  await service.evaluateDelivery(ID, { onTimeScore: 5, qualityScore: 4, observations: "ok" });
  assert.equal(calls, 1);
});
