import { requireCondition } from "../../shared/domain/domain-error.js";
// US20: an absent budget is "not configured", never a budget of zero.
export class PurchaseBudget {
  constructor(data) {
    Object.assign(this, data);
    this.revisions = data.revisions ?? [];
  }
  get configured() {
    return this.status === "Configured" && this.amountPen != null;
  }
  // The first authorization uses expected version 0.
  get expectedVersion() {
    return this.version ?? 0;
  }
  static validate(amount, reason) {
    requireCondition(
      Number.isFinite(amount) &&
        amount > 0 &&
        amount < 1e14 &&
        Math.abs(amount * 10000 - Math.round(amount * 10000)) < 1e-6,
      "budgetAmount",
    );
    const text = (reason ?? "").trim();
    requireCondition(text.length > 0 && text.length <= 2000, "reasonRequired");
  }
}
// Result of contrasting the complete acquisition amount with the current budget.
export class BudgetCheck {
  constructor(data) {
    Object.assign(this, data);
    this.assessment = data.assessment ?? {};
  }
  get status() {
    return this.assessment.status;
  }
  get exceeded() {
    return this.assessment.status === "Exceeded";
  }
  get canApprove() {
    return this.assessment.canApprove === true;
  }
  // Version to send with the approval; 0 states "checked without a budget".
  get budgetVersion() {
    return this.assessment.budgetVersion ?? 0;
  }
  assertApprovable() {
    requireCondition(this.canApprove, "budgetExceeded");
  }
}
