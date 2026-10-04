import {
  REGISTRATION_ROLES,
  isDisplayNameValid,
  isPasswordValid,
} from "../domain/registration.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";

export class RegistrationService {
  constructor(repository) {
    this.repository = repository;
  }

  async register({ email, displayName, password, role }) {
    const address = email.trim();
    const name = displayName.trim();
    requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address), "invalidEmail");
    requireCondition(isDisplayNameValid(name), "displayNameInvalid");
    requireCondition(isPasswordValid(password, address), "passwordPolicy");
    requireCondition(REGISTRATION_ROLES.includes(role), "invalidRole");

    const account = await this.repository.register({
      email: address,
      displayName: name,
      password,
      role,
    });
    return {
      email: account.email,
      status: account.status,
      initialSetup: account.initialSetup,
    };
  }
}
