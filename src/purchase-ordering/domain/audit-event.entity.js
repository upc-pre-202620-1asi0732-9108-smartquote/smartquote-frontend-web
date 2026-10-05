import { requireCondition } from "../../shared/domain/domain-error.js";

export const AUDITED_ENTITY_TYPES = ["PurchaseRequest", "PurchaseOrder"];

export class AuditEvent {
  constructor(data) {
    Object.assign(this, data);
  }

  static validateTimelineRequest(entityType, entityId) {
    requireCondition(AUDITED_ENTITY_TYPES.includes(entityType), "invalidAuditEntity");
    requireCondition(/^[0-9a-f-]{36}$/i.test(entityId), "invalidAuditEntity");
  }
}
