import { AuditTrailRepository } from "../domain/audit-trail.repository.js";
import { AuditEvent } from "../domain/audit-event.entity.js";

export class HttpAuditTrailRepository extends AuditTrailRepository {
  constructor(http) {
    super();
    this.http = http;
  }

  async timeline(entityType, entityId, signal) {
    const events = await this.http.request(`/audit/${entityType}/${entityId}`, { signal });
    return events.map((event) => new AuditEvent(event));
  }
}
