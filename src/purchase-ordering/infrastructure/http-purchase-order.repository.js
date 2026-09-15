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
