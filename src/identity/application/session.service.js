import { Session } from "../domain/session.entity.js";
export class SessionService {
  constructor(repository, verifyAccess) {
    this.repository = repository;
    this.verifyAccess = verifyAccess;
  }
  restore() {
    return this.repository.restore();
  }
  async connect(url, token) {
    const session = new Session(url, token);
    await this.verifyAccess(session);
    this.repository.save(session);
    return session;
  }
  disconnect() {
    this.repository.clear();
  }
}
