import { requireCondition } from "../../shared/domain/domain-error.js";
const transitions = {
  Pending: ["enable"],
  Enabled: ["suspend"],
  Suspended: ["reactivate"],
};
// US18: internal enablement for new purchases. It is not an external certification.
export class SupplierAccount {
  constructor(data) {
    Object.assign(this, data);
    this.history = data.history ?? [];
  }
  get nextActions() {
    return transitions[this.status] ?? [];
  }
  get enabled() {
    return this.status === "Enabled";
  }
  assertDecision(action, reason) {
    requireCondition(this.nextActions.includes(action), "supplierTransition");
    const text = (reason ?? "").trim();
    requireCondition(text.length > 0 && text.length <= 2000, "reasonRequired");
  }
}
