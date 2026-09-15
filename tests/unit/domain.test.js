import test from "node:test";
import assert from "node:assert/strict";
import {
  RequestDraft,
  PurchaseRequest,
} from "../../src/supply-requests/domain/purchase-request.entity.js";
import { PurchaseRequestService } from "../../src/supply-requests/application/purchase-request.service.js";
import { Quotation } from "../../src/quotation-intake/domain/quotation.entity.js";
import {
  defaultCriteria,
  EvaluationScenario,
} from "../../src/evaluation-simulation/domain/evaluation-scenario.entity.js";
import { Simulation } from "../../src/evaluation-simulation/domain/simulation.entity.js";
import { PurchaseOrderService } from "../../src/purchase-ordering/application/purchase-order.service.js";
import {
  Session,
  normalizeBaseUrl,
} from "../../src/identity/domain/session.entity.js";
import { mintToken } from "../../scripts/dev-token.mjs";
const draft = () => ({
  requiredDate: "2026-12-01",
  priority: "High",
  items: [
    {
      description: "Feed",
      quantity: 5,
      unitOfMeasure: "kg",
      requirements: [
        {
          requirementId: "protein",
          name: "Protein",
          operator: "GreaterThanOrEqual",
          expectedValue: "20",
          unitOfMeasure: "%",
          isMandatory: true,
        },
      ],
    },
  ],
});
test("requests reject missing mandatory requirements and invalid quantities", () => {
  const invalid = draft();
  invalid.items[0].requirements[0].isMandatory = false;
  assert.throws(
    () => new RequestDraft(invalid).validate(),
    (e) => e.code === "mandatoryRequired",
  );
  const zero = draft();
  zero.items[0].quantity = 0;
  assert.throws(
    () => new RequestDraft(zero).validate(),
    (e) => e.code === "invalidItem",
  );
  assert.deepEqual(new RequestDraft(draft()).validate(), draft());
});
test("application validates before calling its injected repository", async () => {
  let writes = 0;
  const service = new PurchaseRequestService({
    create: async (p) => {
      writes++;
      return p;
    },
  });
  const invalid = draft();
  invalid.items = [];
  assert.throws(() => service.create(invalid));
  assert.equal(writes, 0);
  await service.create(draft());
  assert.equal(writes, 1);
});
test("request transitions preserve terminal states and require a reason", () => {
  const r = new PurchaseRequest({ status: "UnderReview" });
  assert.doesNotThrow(() =>
    r.assertTransition("QuotationCollection", "Reviewed"),
  );
  assert.throws(
    () => r.assertTransition("Ordered", "Skip stages"),
    (e) => e.code === "transition",
  );
  assert.throws(
    () => r.assertTransition("QuotationCollection", ""),
    (e) => e.code === "reasonRequired",
  );
  assert.deepEqual(new PurchaseRequest({ status: "Ordered" }).nextStatuses, []);
});
test("quotation mappings cover every line; editable fields match API contract", () => {
  const q = new Quotation({
    lines: [
      { lineId: "a", quantity: 2, unitPrice: 30 },
      { lineId: "b", quantity: 1, unitPrice: 10 },
    ],
  });
  assert.equal(q.total, 70);
  assert.throws(
    () => q.assertMappings({ a: "item" }),
    (e) => e.code === "mappingRequired",
  );
  q.assertMappings({ a: "item", b: "item" });
  assert.equal(Quotation.editable("supplier.businessName"), false);
  assert.equal(Quotation.editable("lines[0].unitPrice"), true);
});
test("all mandatory requirements survive defaults and weights must sum to 100", () => {
  const c = defaultCriteria(draft());
  assert.equal(c[0].targetField, "protein");
  assert.equal(c[0].mode, "Mandatory");
  EvaluationScenario.validate(c);
  c[1].weight = 80;
  assert.throws(
    () => EvaluationScenario.validate(c),
    (e) => e.code === "weights",
  );
});
test("simulation cannot approve a superseded scenario or unrelated request", () => {
  const run = new Simulation({
    scenarioId: "old",
    isCurrent: true,
    evaluations: [{ quotationId: "a", isEligible: true }],
  });
  const stale = run.reconcile(
    "r",
    { scenarioId: "new", status: "Active" },
    { requestId: "r" },
  );
  assert.equal(stale.isCurrent, false);
  assert.throws(
    () => stale.assertEligible("a"),
    (e) => e.code === "staleSimulation",
  );
  assert.throws(
    () =>
      run.reconcile(
        "other",
        { scenarioId: "old", status: "Active" },
        { requestId: "r" },
      ),
    (e) => e.code === "wrongRequest",
  );
  assert.throws(
    () => run.assertEligible("b"),
    (e) => e.code === "ineligible",
  );
});
test("order approval revalidates current simulation before persisting", async () => {
  let writes = 0;
  const orders = {
    approve: async () => {
      writes++;
    },
  };
  const evaluations = {
    currentSimulation: async () =>
      new Simulation({ isCurrent: false, evaluations: [] }),
  };
  const service = new PurchaseOrderService(orders, evaluations);
  await assert.rejects(
    service.approve("r", "run", "q", "Hours 8-16", "Warehouse"),
    (e) => e.code === "staleSimulation",
  );
  assert.equal(writes, 0);
});
test("access only allows HTTPS or loopback HTTP; roles do not bypass backend validation", () => {
  assert.equal(
    normalizeBaseUrl("http://localhost:8080/api/v1/"),
    "http://localhost:8080",
  );
  assert.throws(() => normalizeBaseUrl("http://example.com"));
  assert.throws(() => normalizeBaseUrl("https://user:pass@example.com"));
  const token = mintToken(
    "PurchaseManager",
    "test-signing-key-with-at-least-32-bytes",
  );
  const session = new Session(
    "http://localhost:8080",
    token,
    {
      userId: "00000000-0000-0000-0000-000000000001",
      roles: ["PurchaseManager"],
    },
    600,
  );
  assert.equal(session.manager, true);
  assert.throws(
    () =>
      new Session("http://localhost:8080", "", { userId: "x", roles: [] }, 600),
  );
});
