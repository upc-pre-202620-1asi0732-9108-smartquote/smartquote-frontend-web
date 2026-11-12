import { requireCondition } from "../../shared/domain/domain-error.js";
import { PurchaseOrder } from "./purchase-order.entity.js";
// US21: one award per request; a distributed award holds one order per supplier.
export class PurchaseAward {
  constructor(view) {
    Object.assign(this, view.award);
    this.allocations = view.award.allocations ?? [];
    this.orders = (view.orders ?? []).map((order) => new PurchaseOrder(order));
  }
  get distributed() {
    return this.mode === "DistributedByItem";
  }
  get singleOrder() {
    return this.orders.length === 1 ? this.orders[0] : null;
  }
  static validateApproval(run, check, destination, conditions) {
    requireCondition(run.isCurrent, "staleSimulation");
    requireCondition(
      run.distributed && run.distribution?.canApprove === true,
      "incompleteCoverage",
    );
    check.assertApprovable();
    requireCondition(destination.trim() && conditions.trim(), "deliveryRequired");
  }
}
