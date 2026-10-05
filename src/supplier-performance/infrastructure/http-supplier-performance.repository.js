import { SupplierPerformance } from "../domain/supplier-performance.entity.js";

export class HttpSupplierPerformanceRepository {
  constructor(http) {
    this.http = http;
  }

  async performance(taxIdentifier, signal) {
    return new SupplierPerformance(
      await this.http.request(`/suppliers/${taxIdentifier}/performance`, { signal }),
    );
  }
}
