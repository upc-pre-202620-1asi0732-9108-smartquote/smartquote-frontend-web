import test from "node:test";
import assert from "node:assert/strict";
import {
  HttpClient,
  ApiError,
} from "../../src/shared/infrastructure/http-client.js";
import { HttpPurchaseRequestRepository } from "../../src/supply-requests/infrastructure/http-purchase-request.repository.js";
test("HTTP repository sends expectedVersion and client accepts 204 without retries", async () => {
  const original = globalThis.fetch;
  let captured,
    calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    captured = { url, init };
    return new Response(null, { status: 204 });
  };
  try {
    const repository = new HttpPurchaseRequestRepository(
      new HttpClient({ baseUrl: "http://localhost:8080", token: "test" }),
    );
    await repository.changeStatus(
      { requestId: "r", version: 3 },
      "Evaluation",
      "Reviewed",
    );
    assert.deepEqual(JSON.parse(captured.init.body), {
      nextStatus: "Evaluation",
      reason: "Reviewed",
      expectedVersion: 3,
    });
    assert.equal(captured.init.headers.get("Authorization"), "Bearer test");
    assert.equal(captured.init.redirect, "error");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("401, 403 and 409 stay explicit and failed mutations are never retried", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    for (const status of [401, 403, 409]) {
      globalThis.fetch = async () => {
        calls++;
        return new Response("{}", { status });
      };
      await assert.rejects(
        new HttpClient({
          baseUrl: "http://localhost:8080",
          token: "test",
        }).request("/x", { method: "POST" }),
        (e) => e instanceof ApiError && e.status === status,
      );
    }
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
  }
});
