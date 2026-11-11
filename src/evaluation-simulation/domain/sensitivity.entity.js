import { requireCondition } from "../../shared/domain/domain-error.js";
export const MAX_VARIANTS = 20;
// US19: research evidence only. It never issues orders nor replaces the current criteria.
export class SensitivityAnalysis {
  constructor(view) {
    Object.assign(this, view.analysis);
    this.configurations = view.analysis.configurations ?? [];
    this.isCurrent = view.isCurrent;
    this.isStable = view.isStable;
    this.scope = view.scope;
  }
  // The baseline is identified by the API; row order is not a contract.
  get baseline() {
    return (
      this.configurations.find(
        (c) => c.id === this.inputs?.baselineConfigurationId,
      ) ?? this.configurations[0]
    );
  }
  // Baseline first, then the variations numbered from 1 in the API order.
  get comparison() {
    const baseline = this.baseline;
    const variants = this.configurations.filter((c) => c.id !== baseline?.id);
    return [baseline, ...variants].filter(Boolean).map((configuration, index) => ({
      ...configuration,
      isBaseline: configuration.id === baseline?.id,
      variantNumber: index,
      changesRecommendation:
        configuration.recommendedQuotationId !== baseline?.recommendedQuotationId,
    }));
  }
  // Weights refer to the criteria of the version that was analyzed, not the current one.
  weightFor(configuration, category, criteria) {
    const ids = new Set(
      criteria.filter((c) => c.mode === "Weighted" && c.category === category).map((c) => c.criterionId),
    );
    return configuration.weights?.find((w) => ids.has(w.criterionId))?.weight;
  }
  get changedCount() {
    return this.comparison.filter((c) => c.changesRecommendation).length;
  }
  assertPromotable(configurationId) {
    requireCondition(this.isCurrent, "staleAnalysis");
    requireCondition(
      this.configurations.some((c) => c.id === configurationId),
      "sensitivityVariants",
    );
  }
}
// Variants only move the commercial weights (price against delivery time);
// mandatory rules and any other weighted criterion keep their current value.
export function buildVariants(criteria, priceWeights) {
  const weighted = criteria.filter((c) => c.mode === "Weighted");
  const price = weighted.find((c) => c.category === "Price"),
    delivery = weighted.find((c) => c.category === "DeliveryTime");
  requireCondition(
    price?.criterionId && delivery?.criterionId && weighted.every((c) => c.criterionId),
    "scenarioRequired",
  );
  const commercial = price.weight + delivery.weight;
  requireCondition(
    priceWeights.length >= 1 &&
      priceWeights.length <= MAX_VARIANTS &&
      new Set(priceWeights).size === priceWeights.length &&
      priceWeights.every(
        (w) => Number.isFinite(w) && w >= 0 && w <= commercial && w !== price.weight,
      ),
    "sensitivityVariants",
  );
  return priceWeights.map((value) => ({
    weights: weighted.map((c) => ({
      criterionId: c.criterionId,
      weight:
        c === price ? value : c === delivery ? commercial - value : c.weight,
    })),
  }));
}
