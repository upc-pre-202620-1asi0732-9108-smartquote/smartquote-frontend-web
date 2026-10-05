import { requireCondition } from "../../shared/domain/domain-error.js";
export class PurchaseOrder {
  constructor(data) {
    Object.assign(this, data);
    this.lines = data.lines ?? [];
  }
  static validateEvaluation({ onTimeScore, qualityScore, observations }) {
    const isScore = (value) => Number.isInteger(value) && value >= 1 && value <= 5;
    requireCondition(isScore(onTimeScore), "invalidScore");
    requireCondition(isScore(qualityScore), "invalidScore");
    requireCondition((observations ?? "").trim().length <= 500, "observationsTooLong");
  }

  static validateApproval(run, quoteId, destination, conditions) {
    run.assertEligible(quoteId);
    requireCondition(
      destination.trim() && conditions.trim(),
      "deliveryRequired",
    );
  }
}
