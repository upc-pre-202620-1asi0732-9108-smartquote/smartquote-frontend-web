import { Session } from "../domain/session.entity.js";
const key = "smartquote.session.v2";
export class BrowserSessionRepository {
  restore() {
    try {
      const value = JSON.parse(sessionStorage.getItem(key));
      return value ? new Session(value.baseUrl, value.token) : null;
    } catch {
      this.clear();
      return null;
    }
  }
  save(session) {
    sessionStorage.setItem(
      key,
      JSON.stringify({ baseUrl: session.baseUrl, token: session.token }),
    );
    localStorage.setItem("smartquote.api", session.baseUrl);
  }
  clear() {
    sessionStorage.removeItem(key);
    sessionStorage.removeItem("smartquote.session.v1");
  }
}
