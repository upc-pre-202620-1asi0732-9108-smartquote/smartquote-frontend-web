import { PurchaseAward } from "../domain/purchase-award.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";
// US21: approval of a distributed award. The API issues every order or none.
export class PurchaseAwardService {
  constructor(repository, evaluationService) {
    this.repository = repository;
    this.evaluationService = evaluationService;
  }
  findByRequest(requestId, signal) {
    return this.repository.findByRequest(requestId, signal);
  }
  async approve(requestId, runId, check, conditions, destination, idempotencyKey) {
    requireCondition(
      typeof idempotencyKey === "string" &&
        idempotencyKey.length > 0 &&
        idempotencyKey.length <= 100,
      "idempotencyKey",
    );
    const current = await this.evaluationService.currentSimulation(requestId, runId);
    PurchaseAward.validateApproval(current, check, destination, conditions);
    return this.repository.approve(runId, idempotencyKey, {
      deliveryConditions: conditions.trim(),
      deliveryDestination: destination.trim(),
      expectedBudgetVersion: check.budgetVersion,
      // The fingerprint that the budget check evaluated, so both refer to the same decision.
      expectedInputFingerprint: check.inputFingerprint,
    });
  }
}
