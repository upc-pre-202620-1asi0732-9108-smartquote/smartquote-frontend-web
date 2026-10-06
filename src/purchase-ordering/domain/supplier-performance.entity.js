import { requireCondition } from "../../shared/domain/domain-error.js";

export class SupplierPerformance {
  constructor(data) {
    Object.assign(this, data);
    this.evaluations = Array.isArray(data.evaluations) ? data.evaluations : null;
  }

  static validateTaxIdentifier(taxIdentifier) {
    requireCondition(/^\d{11}$/.test(taxIdentifier.trim()), "invalidTaxId");
  }
}
