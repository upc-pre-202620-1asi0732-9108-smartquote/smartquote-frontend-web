import { REGISTRATION_ROLES } from "../domain/registration.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";

export class RegistrationApprovalService {
  constructor(repository) {
    this.repository = repository;
  }

  pending(signal) {
    return this.repository.pending(signal);
  }

  async approve(userId, role) {
    requireCondition(REGISTRATION_ROLES.includes(role), "invalidRole");
    return this.repository.approve(userId, role);
  }

  async reject(userId) {
    return this.repository.reject(userId);
  }
}
