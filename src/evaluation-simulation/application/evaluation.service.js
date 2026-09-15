import { EvaluationScenario } from "../domain/evaluation-scenario.entity.js";
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
  async currentSimulation(requestId, id, signal) {
    const [run, current] = await Promise.all([
      this.repository.simulation(id, signal),
      this.repository.current(requestId, signal),
    ]);
    const origin = await this.repository.get(run.scenarioId);
    return run.reconcile(requestId, current, origin);
  }
}
