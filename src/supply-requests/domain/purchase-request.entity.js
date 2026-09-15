import { requireCondition } from "../../shared/domain/domain-error.js";
export const transitions = {
  Submitted: ["UnderReview", "Cancelled"],
  UnderReview: ["QuotationCollection", "Rejected", "Cancelled"],
  QuotationCollection: ["Evaluation", "Rejected", "Cancelled"],
  Evaluation: ["QuotationCollection", "Approved", "Rejected", "Cancelled"],
  Approved: ["Evaluation", "Ordered", "Cancelled"],
};
export class PurchaseRequest {
  constructor(data) {
    Object.assign(this, data);
    this.items = data.items ?? [];
    this.attachments = data.attachments ?? [];
  }
  get title() {
    return this.items[0]?.description ?? "";
  }
  get nextStatuses() {
    return transitions[this.status] ?? [];
  }
  get acceptsQuotations() {
    return ["QuotationCollection", "Evaluation"].includes(this.status);
  }
  assertTransition(status, reason) {
    requireCondition(this.nextStatuses.includes(status), "transition");
    requireCondition(reason.trim().length > 0, "reasonRequired");
  }
}
export class RequestDraft {
  constructor(data) {
    this.requiredDate = data.requiredDate;
    this.priority = data.priority;
    this.items = data.items;
  }
  validate() {
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(this.requiredDate),
      "dateRequired",
    );
    requireCondition(
      ["Normal", "High", "Emergency"].includes(this.priority),
      "invalidPriority",
    );
    requireCondition(this.items.length > 0, "itemRequired");
    for (const item of this.items) {
      requireCondition(
        item.description.trim() &&
          item.unitOfMeasure.trim() &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0,
        "invalidItem",
      );
      requireCondition(
        item.requirements.some((r) => r.isMandatory),
        "mandatoryRequired",
      );
      for (const r of item.requirements)
        requireCondition(
          r.name.trim() &&
            r.expectedValue.trim() &&
            [
              "Equals",
              "Contains",
              "GreaterThanOrEqual",
              "LessThanOrEqual",
            ].includes(r.operator),
          "invalidRequirement",
        );
    }
    return {
      requiredDate: this.requiredDate,
      priority: this.priority,
      items: this.items,
    };
  }
}
