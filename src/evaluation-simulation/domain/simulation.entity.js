import { requireCondition } from "../../shared/domain/domain-error.js";
export class Simulation {
  constructor(data) {
    Object.assign(this, data);
    this.evaluations = data.evaluations ?? [];
  }
  // US21: the run assigns one supplier per item instead of a single winner.
  get distributed() {
    return this.mode === "DistributedByItem";
  }
  reconcile(requestId, current, origin) {
    requireCondition(origin.requestId === requestId, "wrongRequest");
    return new Simulation({
      ...this,
      isCurrent:
        this.isCurrent &&
        current.scenarioId === this.scenarioId &&
        current.status === "Active",
    });
  }
  assertEligible(quotationId) {
    requireCondition(this.isCurrent, "staleSimulation");
    requireCondition(
      this.evaluations.some(
        (e) => e.quotationId === quotationId && e.isEligible,
      ),
      "ineligible",
    );
  }
}
