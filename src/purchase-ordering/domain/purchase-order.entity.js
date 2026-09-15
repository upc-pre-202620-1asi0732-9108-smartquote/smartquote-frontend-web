import { requireCondition } from "../../shared/domain/domain-error.js";
export class PurchaseOrder {
  constructor(data) {
    Object.assign(this, data);
    this.lines = data.lines ?? [];
  }
  static validateApproval(run, quoteId, destination, conditions) {
    run.assertEligible(quoteId);
    requireCondition(
      destination.trim() && conditions.trim(),
      "deliveryRequired",
    );
  }
}
