import test from "node:test";
import assert from "node:assert/strict";
import { PurchasingMetricsService } from "../../src/purchase-ordering/application/purchasing-metrics.service.js";
import { HttpPurchasingMetricsRepository } from "../../src/purchase-ordering/infrastructure/http-purchasing-metrics.repository.js";

// US14 E2 E3: validación o contrato del cliente; los dobles no prueban persistencia.
test("US14 E2 E3 — purchasing metrics send the selected period and keep unavailable values as null", async () => {
  let requested;
  const signal = new AbortController().signal;
  const repository = new HttpPurchasingMetricsRepository({
    request: async (path, options) => {
      requested = { path, options };
      return {
        from: "2026-10-01",
        to: "2026-10-31",
        orderCount: 0,
        averageProcessingHours: null,
        comparativeSavings: null,
      };
    },
  });
  const service = new PurchasingMetricsService(repository);

  const result = await service.get("2026-10-01", "2026-10-31", signal);
  assert.equal(requested.path, "/purchasing-metrics?from=2026-10-01&to=2026-10-31");
  assert.equal(requested.options.signal, signal);
  assert.equal(result.averageProcessingHours, null);
  assert.equal(result.comparativeSavings, null);
  assert.throws(() => service.get("2026-11-01", "2026-10-31"),
    (error) => error.code === "invalidPeriod");
});
