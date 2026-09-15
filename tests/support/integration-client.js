import { createServices } from "../../src/app/composition-root.js";
import { Session } from "../../src/identity/domain/session.entity.js";
export const parseSession = (baseUrl, token) => new Session(baseUrl, token);
export class IntegrationClient {
  constructor(session) {
    this.session = session;
    this.services = createServices(session);
    const { requests, quotations, evaluations, orders } = this.services;
    for (const [name, service, method] of [
      ["listRequests", requests, "list"],
      ["request", requests, "get"],
      ["createRequest", requests, "create"],
      ["history", requests, "history"],
      ["changeStatus", requests, "changeStatus"],
      ["attach", requests, "attach"],
      ["notifications", requests, "notifications"],
      ["readNotification", requests, "readNotification"],
      ["quotes", quotations, "list"],
      ["quote", quotations, "get"],
      ["upload", quotations, "upload"],
      ["process", quotations, "process"],
      ["correct", quotations, "correct"],
      ["confirm", quotations, "confirm"],
      ["scenario", evaluations, "current"],
      ["scenarioById", evaluations, "get"],
      ["saveScenario", evaluations, "save"],
      ["simulate", evaluations, "simulate"],
      ["simulation", evaluations, "simulation"],
      ["currentSimulation", evaluations, "currentSimulation"],
      ["orderByRun", orders, "findBySimulation"],
    ])
      this[name] = service[method].bind(service);
  }
  async approve(runId, quoteId, conditions, destination) {
    const run = await this.services.evaluations.simulation(runId);
    const scenario = await this.services.evaluations.get(run.scenarioId);
    return this.services.orders.approve(
      scenario.requestId,
      runId,
      quoteId,
      conditions,
      destination,
    );
  }
}
