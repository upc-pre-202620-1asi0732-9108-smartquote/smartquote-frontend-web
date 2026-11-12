import { PurchaseOrder } from "../domain/purchase-order.entity.js";
export class PurchaseOrderService {
  constructor(repository, evaluationService) {
    this.repository = repository;
    this.evaluationService = evaluationService;
  }
  findBySimulation(id) {
    return this.repository.findBySimulation(id);
  }
  findByRequest(id, signal) {
    return this.repository.findByRequest(id, signal);
  }
  markDelivered(orderId) {
    return this.repository.markDelivered(orderId);
  }

  async evaluateDelivery(orderId, evaluation) {
    PurchaseOrder.validateEvaluation(evaluation);
    return this.repository.evaluateDelivery(orderId, evaluation);
  }

  // US20: when a budget check was shown, its version travels with the approval so an
  // outdated check is rejected. The API always validates the current budget.
  async approve(requestId, runId, quoteId, conditions, destination, check = null) {
    const current = await this.evaluationService.currentSimulation(
      requestId,
      runId,
    );
    PurchaseOrder.validateApproval(current, quoteId, destination, conditions);
    check?.assertApprovable();
    return this.repository.approve(
      runId,
      quoteId,
      conditions,
      destination,
      check?.budgetVersion,
    );
  }
}
