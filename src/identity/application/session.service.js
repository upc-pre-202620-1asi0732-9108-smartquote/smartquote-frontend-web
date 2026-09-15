import { Session } from "../domain/session.entity.js";
export class SessionService {
  constructor(repository) {
    this.repository = repository;
  }
  async restore() {
    try {
      return this.toSession(await this.repository.refresh());
    } catch (error) {
      if (error?.status === 401) return null;
      throw error;
    }
  }
  async login(email, password) {
    return this.toSession(await this.repository.login(email, password));
  }
  logout() {
    return this.repository.logout();
  }
  toSession(response) {
    return new Session(
      this.repository.baseUrl,
      response.accessToken,
      response.user,
      response.expiresIn,
    );
  }
}
