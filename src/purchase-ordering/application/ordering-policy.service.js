import { PurchaseBudget } from "../domain/purchase-budget.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";
const statuses = ["Pending", "Enabled", "Suspended"];
// US18: supplier enablement for new purchases.
export class SupplierEligibilityService {
  constructor(repository) {
    this.repository = repository;
  }
  list(status, signal) {
    requireCondition(!status || statuses.includes(status), "supplierTransition");
    return this.repository.list(status, signal);
  }
  get(id, signal) {
    return this.repository.get(id, signal);
  }
  decide(supplier, action, reason) {
    supplier.assertDecision(action, reason);
    return this.repository.decide(supplier, action, reason.trim());
  }
}
// US20: budget authorization and its contrast against the amounts to be issued.
export class PurchaseBudgetService {
  constructor(repository) {
    this.repository = repository;
  }
  get(requestId, signal) {
    return this.repository.get(requestId, signal);
  }
  authorize(request, budget, amount, reason) {
    requireCondition(request.isActive, "budgetInactive");
    PurchaseBudget.validate(amount, reason);
    return this.repository.authorize(
      request.requestId,
      amount,
      reason.trim(),
      budget?.expectedVersion ?? 0,
    );
  }
  check(runId, quotationId, signal) {
    return this.repository.check(runId, quotationId, signal);
  }
  checkAward(runId, signal) {
    return this.repository.checkAward(runId, signal);
  }
}
