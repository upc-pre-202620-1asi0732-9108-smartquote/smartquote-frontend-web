import test from "node:test";
import assert from "node:assert/strict";
import { HttpEvaluationRepository } from "../../src/evaluation-simulation/infrastructure/http-evaluation.repository.js";
import { QuotationService } from "../../src/quotation-intake/application/quotation.service.js";
import { Quotation } from "../../src/quotation-intake/domain/quotation.entity.js";

// US04/E1-E2: límites del cliente; daño/legibilidad se prueban en backend.
test("US04 E1 E2 — upload accepts PDF within the configured limit and rejects invalid client input", () => {
  const supplier = { supplierId: "id", supplierBusinessName: "Provider", supplierTaxIdentifier: "20123456789" };
  assert.doesNotThrow(() => Quotation.validateUpload(supplier, { name: "offer.pdf", size: 1024 }));
  for (const file of [{ name: "offer.txt", size: 100 }, { name: "empty.pdf", size: 0 }, { name: "huge.pdf", size: 15 * 1024 * 1024 + 1 }]) {
    assert.throws(() => Quotation.validateUpload(supplier, file));
  }
});

// TS03/E1-E2: el cliente conserva importes y tasa del backend, sin consultar SUNAT.
test("TS03 E1 E2 — simulation preserves original USD, comparable PEN and immutable rate trace", async () => {
  const response = {
    simulationRunId: "run", isCurrent: true,
    exchangeRate: { sourceCurrency: "USD", targetCurrency: "PEN", rate: 3.5,
      publishedOn: "2026-10-07", source: "SUNAT", retrievedAt: "2026-10-07T12:00:00Z" },
    evaluations: [{ quotationId: "usd", originalCurrency: "USD", originalTotal: 1000,
      comparisonCurrency: "PEN", comparisonTotal: 3500, conversionApplied: true }],
  };
  const paths = [];
  const repository = new HttpEvaluationRepository({ request: async (path) => {
    paths.push(path); return structuredClone(response);
  } });
  const first = await repository.simulate("scenario");
  const reloaded = await repository.simulation("run");
  assert.deepEqual(reloaded.exchangeRate, response.exchangeRate);
  assert.deepEqual(first.evaluations, response.evaluations);
  assert.deepEqual(paths, ["/evaluation-scenarios/scenario/simulations", "/simulations/run"]);
});

// TS03/E3: 503 no se sustituye por una tasa o resultado guardado en el cliente.
test("TS03 E3 — unavailable official source rejects simulation without client fallback", async () => {
  const failure = Object.assign(new Error("Official rate unavailable"), { status: 503, code: "external_service_unavailable" });
  const repository = new HttpEvaluationRepository({ request: async () => { throw failure; } });
  await assert.rejects(repository.simulate("scenario"), (error) => error === failure);
});

// US05/E2: el identificador, valor original y versión son los del documento recibido.
test("US05 E2 — correction requires a supported existing field, value and reason", async () => {
  const calls = [];
  const service = new QuotationService({ correct: async (...args) => calls.push(args) });
  const quote = { quotationId: "q", version: 3, fields: [{ fieldId: "price", fieldPath: "lines[0].unitPrice", originalValue: "4" }] };
  assert.throws(() => service.correct(quote, "other", "4.5", "Evidence"));
  assert.throws(() => service.correct(quote, "price", "4.5", ""));
  assert.equal(calls.length, 0);
  await service.correct(quote, "price", "4.5", "Document evidence");
  assert.equal(calls[0][0].version, 3);
  assert.equal(calls[0][0].fields[0].originalValue, "4");
  assert.deepEqual(calls[0].slice(1), ["price", "4.5", "Document evidence"]);
});
