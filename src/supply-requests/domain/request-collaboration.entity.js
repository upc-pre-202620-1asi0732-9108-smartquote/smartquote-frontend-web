import { requireCondition } from "../../shared/domain/domain-error.js";
const operators = ["Equals", "Contains", "GreaterThanOrEqual", "LessThanOrEqual"];
const validText = (value, max = 4000) => {
  const text = (value ?? "").trim();
  return text.length > 0 && text.length <= max;
};
// US15: a clarification stays linked to the item and requirement that originated it.
export class Clarification {
  constructor(data) {
    Object.assign(this, data);
  }
  get pending() {
    return this.status === "Pending";
  }
  get answered() {
    return this.status === "Answered";
  }
  canBeAnsweredBy(userId) {
    return this.pending && this.specialistId === userId;
  }
  // A revision needs an answered clarification raised against the current technical revision.
  canBeRevisedBy(userId, request) {
    return (
      this.answered &&
      this.specialistId === userId &&
      this.sourceTechnicalRevision === (request.technicalRevision ?? 0)
    );
  }
  static validateQuestion(request, { itemId, requirementId, question }) {
    const item = request.items.find((entry) => entry.itemId === itemId);
    requireCondition(
      item?.requirements.some((r) => r.requirementId === requirementId),
      "clarificationTarget",
    );
    requireCondition(validText(question), "clarificationText");
  }
  static validateAnswer(answer) {
    requireCondition(validText(answer), "clarificationText");
  }
  static validateRevision(specification, reason, current) {
    const same = (a, b) => (a ?? "").trim() === (b ?? "").trim();
    requireCondition(
      !current ||
        !(
          same(specification.name, current.name) &&
          specification.operator === current.operator &&
          same(specification.expectedValue, current.expectedValue) &&
          same(specification.unitOfMeasure, current.unitOfMeasure) &&
          specification.isMandatory === current.isMandatory
        ),
      "unchangedRequirement",
    );
    requireCondition(
      specification.name.trim() &&
        specification.expectedValue.trim() &&
        operators.includes(specification.operator),
      "invalidRequirement",
    );
    requireCondition(validText(reason, 2000), "reasonRequired");
  }
}
// US22: one responsible analyst per request; a reassignment must be justified.
export function validateAssignment(request, analystId, reason) {
  requireCondition(Boolean(analystId), "analystRequired");
  requireCondition(request.assignedAnalystId !== analystId, "sameAnalyst");
  requireCondition(
    !request.assignedAnalystId || validText(reason, 2000),
    "reasonRequired",
  );
}
