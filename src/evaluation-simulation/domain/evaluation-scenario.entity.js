import { requireCondition } from "../../shared/domain/domain-error.js";
export class EvaluationScenario {
  constructor(data) {
    Object.assign(this, data);
    this.criteria = data.criteria ?? [];
  }
  static validate(criteria) {
    const weighted = criteria.filter((c) => c.mode === "Weighted");
    requireCondition(
      criteria.some((c) => c.mode === "Mandatory") && weighted.length > 0,
      "criteriaRequired",
    );
    requireCondition(
      weighted.every((c) => Number.isFinite(c.weight) && c.weight >= 0) &&
        Math.abs(weighted.reduce((sum, c) => sum + c.weight, 0) - 100) < 0.001,
      "weights",
    );
    return criteria;
  }
}
export function defaultCriteria(request) {
  const technical = request.items.flatMap((item) =>
    item.requirements
      .filter((r) => r.isMandatory)
      .map((r) => ({
        name: `${item.description}: ${r.name}`,
        targetField: r.requirementId,
        category: "TechnicalCompliance",
        mode: "Mandatory",
        operator: r.operator,
        expectedValue: r.expectedValue,
        unitOfMeasure: r.unitOfMeasure,
        weight: 0,
        displayOrder: 0,
      })),
  );
  return [
    ...technical,
    {
      name: "Total price",
      targetField: "totalPrice",
      category: "Price",
      mode: "Weighted",
      operator: "LessThanOrEqual",
      expectedValue: "999999999",
      unitOfMeasure: "",
      weight: 60,
    },
    {
      name: "Delivery lead time",
      targetField: "deliveryLeadTimeDays",
      category: "DeliveryTime",
      mode: "Weighted",
      operator: "LessThanOrEqual",
      expectedValue: "365",
      unitOfMeasure: "days",
      weight: 40,
    },
  ].map((c, i) => ({ ...c, displayOrder: i + 1 }));
}
