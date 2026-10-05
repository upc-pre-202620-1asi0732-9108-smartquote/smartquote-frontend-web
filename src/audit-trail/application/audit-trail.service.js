import { AuditEvent } from "../domain/audit-event.entity.js";

export class AuditTrailService {
  constructor(repository) {
    this.repository = repository;
  }

  async timeline(entityType, entityId, signal) {
    AuditEvent.validateTimelineRequest(entityType, entityId);
    return this.repository.timeline(entityType, entityId, signal);
  }
}
