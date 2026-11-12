import { SupplierAccount } from "../domain/supplier-account.entity.js";
import { BudgetCheck, PurchaseBudget } from "../domain/purchase-budget.entity.js";
import { PurchaseAward } from "../domain/purchase-award.entity.js";
export class HttpSupplierEligibilityRepository {
  constructor(http) {
    this.http = http;
  }
  async list(status = "", signal) {
    return (
      await this.http.request(
        "/suppliers?" +
          new URLSearchParams({
            ...(status ? { status } : {}),
            page: "1",
            pageSize: "100",
          }),
        { signal },
      )
    ).map((dto) => new SupplierAccount(dto));
  }
  async get(id, signal) {
    return new SupplierAccount(await this.http.request(`/suppliers/${id}`, { signal }));
  }
  async decide(supplier, action, reason) {
    return new SupplierAccount(
      await this.http.request(`/suppliers/${supplier.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason, expectedVersion: supplier.version }),
      }),
    );
  }
}
export class HttpPurchaseBudgetRepository {
  constructor(http) {
    this.http = http;
  }
  async get(requestId, signal) {
    return new PurchaseBudget(
      await this.http.request(`/purchase-requests/${requestId}/budget`, { signal }),
    );
  }
  async authorize(requestId, amount, reason, expectedVersion) {
    return new PurchaseBudget(
      await this.http.request(`/purchase-requests/${requestId}/budget`, {
        method: "PUT",
        body: JSON.stringify({ amount, currency: "PEN", reason, expectedVersion }),
      }),
    );
  }
  async check(runId, quotationId, signal) {
    return new BudgetCheck(
      await this.http.request(
        `/simulations/${runId}/budget-check?` + new URLSearchParams({ quotationId }),
        { signal },
      ),
    );
  }
  async checkAward(runId, signal) {
    return new BudgetCheck(
      await this.http.request(`/simulations/${runId}/purchase-award-budget-check`, {
        signal,
      }),
    );
  }
}
export class HttpPurchaseAwardRepository {
  constructor(http) {
    this.http = http;
  }
  async findByRequest(requestId, signal) {
    return new PurchaseAward(
      await this.http.request(`/purchase-requests/${requestId}/purchase-award`, {
        signal,
      }),
    );
  }
  async approve(runId, idempotencyKey, body) {
    return new PurchaseAward(
      await this.http.request(`/simulations/${runId}/purchase-awards`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      }),
    );
  }
}
