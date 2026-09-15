import { EvaluationRepository } from "../domain/evaluation.repository.js";
import { EvaluationScenario } from "../domain/evaluation-scenario.entity.js";
import { Simulation } from "../domain/simulation.entity.js";
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
  async simulation(id, signal) {
    return new Simulation(
      await this.http.request(`/simulations/${encodeURIComponent(id)}`, {
        signal,
      }),
    );
  }
}
