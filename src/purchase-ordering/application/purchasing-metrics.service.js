import { DomainError } from "../../shared/domain/domain-error.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class PurchasingMetricsService {
  constructor(repository) {
    this.repository = repository;
  }

  get(from, to, signal) {
    if (!datePattern.test(from) || !datePattern.test(to) || from > to)
      throw new DomainError("invalidPeriod");
    return this.repository.get(from, to, signal);
  }
}
