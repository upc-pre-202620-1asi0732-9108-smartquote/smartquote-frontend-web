import { PurchaseOrderRepository } from "../domain/purchase-order.repository.js";
import { PurchaseOrder } from "../domain/purchase-order.entity.js";
export class HttpPurchaseOrderRepository extends PurchaseOrderRepository {
  constructor(http) {
    super();
    this.http = http;
  }
  async findBySimulation(id) {
    return new PurchaseOrder(
      await this.http.request(`/simulations/${id}/purchase-order`),
    );
  }
  async findByRequest(id, signal) {
    return new PurchaseOrder(
      await this.http.request(`/purchase-requests/${id}/purchase-order`, { signal }),
    );
  }
  async markDelivered(orderId) {
    return new PurchaseOrder(
      await this.http.request(`/purchase-orders/${orderId}/delivery`, { method: "POST" }),
    );
  }

  async evaluateDelivery(orderId, { onTimeScore, qualityScore, observations }) {
    return this.http.request(`/purchase-orders/${orderId}/delivery-evaluation`, {
      method: "POST",
      body: JSON.stringify({ onTimeScore, qualityScore, observations: observations?.trim() || null }),
    });
  }

  async approve(run, quote, deliveryConditions, deliveryDestination) {
    return new PurchaseOrder(
      await this.http.request(
        `/simulations/${run}/quotations/${quote}/purchase-orders`,
        {
          method: "POST",
          body: JSON.stringify({ deliveryConditions, deliveryDestination }),
        },
      ),
    );
  }
}
