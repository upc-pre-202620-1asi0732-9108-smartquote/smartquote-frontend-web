import { SupplierPerformance } from "../domain/supplier-performance.entity.js";

export class SupplierPerformanceService {
  constructor(repository) {
    this.repository = repository;
  }

  async performance(taxIdentifier, signal) {
    const trimmed = taxIdentifier.trim();
    SupplierPerformance.validateTaxIdentifier(trimmed);
    return this.repository.performance(trimmed, signal);
  }
}
