import { EvaluationRepository } from "../domain/evaluation.repository.js";
import { EvaluationScenario } from "../domain/evaluation-scenario.entity.js";
import { Simulation } from "../domain/simulation.entity.js";
import { SensitivityAnalysis } from "../domain/sensitivity.entity.js";
export class HttpEvaluationRepository extends EvaluationRepository {
  constructor(http) {
    super();
    this.http = http;
  }
  async current(id, signal) {
    return new EvaluationScenario(
      await this.http.request(`/purchase-requests/${id}/evaluation-scenario`, {
        signal,
      }),
    );
  }
  async get(id) {
    return new EvaluationScenario(
      await this.http.request(`/evaluation-scenarios/${id}`),
    );
  }
  async save(requestId, criteria, current) {
    return new EvaluationScenario(
      await this.http.request(
        current
          ? `/evaluation-scenarios/${current.scenarioId}/versions`
          : "/evaluation-scenarios",
        { method: "POST", body: JSON.stringify({ requestId, criteria }) },
      ),
    );
  }
  async simulate(id) {
    return new Simulation(
      await this.http.request(`/evaluation-scenarios/${id}/simulations`, {
        method: "POST",
      }),
    );
  }
  async simulateDistributed(id) {
    return new Simulation(
      await this.http.request(`/evaluation-scenarios/${id}/distributed-simulations`, {
        method: "POST",
      }),
    );
  }
  async createSensitivity(scenarioId, configurations) {
    return new SensitivityAnalysis(
      await this.http.request(`/evaluation-scenarios/${scenarioId}/sensitivity-analyses`, {
        method: "POST",
        body: JSON.stringify({ configurations }),
      }),
    );
  }
  async sensitivityAnalyses(requestId, signal) {
    return (
      await this.http.request(`/purchase-requests/${requestId}/sensitivity-analyses`, {
        signal,
      })
    ).map((dto) => new SensitivityAnalysis(dto));
  }
  promoteSensitivity(analysisId, configurationId, expectedCriteriaVersion) {
    return this.http.request(
      `/sensitivity-analyses/${analysisId}/configurations/${configurationId}/official-simulation`,
      { method: "POST", body: JSON.stringify({ expectedCriteriaVersion }) },
    );
  }
  async simulation(id, signal) {
    return new Simulation(
      await this.http.request(`/simulations/${encodeURIComponent(id)}`, {
        signal,
      }),
    );
  }
  async listForRequest(requestId, signal) {
    return (await this.http.request(`/purchase-requests/${requestId}/simulations`, { signal }))
      .map((dto) => new Simulation(dto));
  }
}
