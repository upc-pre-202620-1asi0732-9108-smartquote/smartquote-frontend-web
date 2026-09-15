import { PurchaseOrder } from "../domain/purchase-order.entity.js";
export class PurchaseOrderService {
  constructor(repository, evaluationService) {
    this.repository = repository;
    this.evaluationService = evaluationService;
  }
  findBySimulation(id) {
    return this.repository.findBySimulation(id);
  }
  async approve(requestId, runId, quoteId, conditions, destination) {
    const current = await this.evaluationService.currentSimulation(
      requestId,
      runId,
    );
    PurchaseOrder.validateApproval(current, quoteId, destination, conditions);
    return this.repository.approve(runId, quoteId, conditions, destination);
  }
}
