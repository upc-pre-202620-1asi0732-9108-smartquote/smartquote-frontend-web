import { EvaluationScenario } from "../domain/evaluation-scenario.entity.js";
import { buildVariants } from "../domain/sensitivity.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";
export class EvaluationService {
  constructor(repository) {
    this.repository = repository;
  }
  current(id, signal) {
    return this.repository.current(id, signal);
  }
  get(id) {
    return this.repository.get(id);
  }
  save(id, criteria, current) {
    return this.repository.save(
      id,
      EvaluationScenario.validate(criteria),
      current,
    );
  }
  simulate(id) {
    return this.repository.simulate(id);
  }
  simulation(id, signal) {
    return this.repository.simulation(id, signal);
  }
  listForRequest(id, signal) {
    return this.repository.listForRequest(id, signal);
  }
  // US21: needs saved criteria and more than one item to distribute.
  simulateDistributed(scenario, request) {
    requireCondition(Boolean(scenario?.scenarioId), "scenarioRequired");
    requireCondition(request.items.length >= 2, "distributedItems");
    return this.repository.simulateDistributed(scenario.scenarioId);
  }
  // US19
  sensitivityAnalyses(requestId, signal) {
    return this.repository.sensitivityAnalyses(requestId, signal);
  }
  analyzeSensitivity(scenario, priceWeights) {
    requireCondition(
      Boolean(scenario?.scenarioId) && scenario.status === "Active",
      "scenarioRequired",
    );
    return this.repository.createSensitivity(
      scenario.scenarioId,
      buildVariants(scenario.criteria, priceWeights),
    );
  }
  // The analysis never issues an order: promotion creates official criteria and a
  // simulation that still go through the regular approval.
  async promoteSensitivity(analysis, configurationId) {
    analysis.assertPromotable(configurationId);
    const { scenarioId, simulationRunId } = await this.repository.promoteSensitivity(
      analysis.id,
      configurationId,
      analysis.criteriaVersion,
    );
    const [scenario, simulation] = await Promise.all([
      this.repository.get(scenarioId),
      this.repository.simulation(simulationRunId),
    ]);
    return { scenario, simulation };
  }
  async currentSimulation(requestId, id, signal) {
    const [run, current] = await Promise.all([
      this.repository.simulation(id, signal),
      this.repository.current(requestId, signal),
    ]);
    const origin = await this.repository.get(run.scenarioId);
    return run.reconcile(requestId, current, origin);
  }
}
