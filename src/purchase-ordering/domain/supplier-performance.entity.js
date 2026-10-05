import { requireCondition } from "../../shared/domain/domain-error.js";

export class SupplierPerformance {
  constructor(data) {
    Object.assign(this, data);
  }

  static validateTaxIdentifier(taxIdentifier) {
    requireCondition(/^\d{11}$/.test(taxIdentifier.trim()), "invalidTaxId");
  }
}
