export class HttpRegistrationApprovalRepository {
  constructor(http) {
    this.http = http;
  }

  pending(signal) {
    return this.http.request("/iam/registration-requests", { signal });
  }

  approve(userId, role) {
    return this.http.request(`/iam/registration-requests/${userId}/approve`, {
      method: "POST",
      body: JSON.stringify({ role }),
    });
  }

  reject(userId) {
    return this.http.request(`/iam/registration-requests/${userId}/reject`, {
      method: "POST",
    });
  }
}
