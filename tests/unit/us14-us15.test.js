import test from "node:test";
import assert from "node:assert/strict";
import { AuditTrailService } from "../../src/purchase-ordering/application/audit-trail.service.js";
import { SupplierPerformanceService } from "../../src/purchase-ordering/application/supplier-performance.service.js";
import { PurchaseOrder } from "../../src/purchase-ordering/domain/purchase-order.entity.js";
import { PurchaseOrderService } from "../../src/purchase-ordering/application/purchase-order.service.js";

const ID = "4c1d2b3a-0000-4000-8000-000000000001";

test("audit timeline only accepts audited entity types and well-formed identifiers", async () => {
  let calls = 0;
  const service = new AuditTrailService({ timeline: async () => { calls++; return []; } });
  await assert.rejects(service.timeline("Supplier", ID), { code: "invalidAuditEntity" });
  await assert.rejects(service.timeline("PurchaseOrder", "not-a-guid"), { code: "invalidAuditEntity" });
  assert.equal(calls, 0);
  assert.deepEqual(await service.timeline("PurchaseOrder", ID), []);
  assert.equal(calls, 1);
});

test("supplier performance trims and requires an 11-digit tax identifier", async () => {
  let sent;
  const service = new SupplierPerformanceService({
    performance: async (taxId) => { sent = taxId; return { supplierTaxIdentifier: taxId }; },
  });
  await assert.rejects(service.performance("2069876543"), { code: "invalidTaxId" });
  await assert.rejects(service.performance("abc12345678"), { code: "invalidTaxId" });
  await service.performance(" 20698765432 ");
  assert.equal(sent, "20698765432");
});

test("delivery evaluation requires whole scores from 1 to 5 and bounded observations", () => {
  assert.doesNotThrow(() => PurchaseOrder.validateEvaluation({ onTimeScore: 1, qualityScore: 5, observations: "" }));
  for (const bad of [0, 6, 3.5, null]) {
    assert.throws(() => PurchaseOrder.validateEvaluation({ onTimeScore: bad, qualityScore: 4 }), { code: "invalidScore" });
  }
  assert.throws(
    () => PurchaseOrder.validateEvaluation({ onTimeScore: 4, qualityScore: 4, observations: "x".repeat(501) }),
    { code: "observationsTooLong" },
  );
});

test("order service validates the evaluation before calling the repository", async () => {
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
