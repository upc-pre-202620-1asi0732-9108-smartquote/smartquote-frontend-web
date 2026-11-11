import { RecurringSchedule } from "../domain/recurring-schedule.entity.js";
export class HttpRecurringScheduleRepository {
  constructor(http) {
    this.http = http;
  }
  async list(signal) {
    return (
      await this.http.request("/recurring-request-schedules?page=1&pageSize=100", {
        signal,
      })
    ).map((dto) => new RecurringSchedule(dto));
  }
  async get(id, signal) {
    return new RecurringSchedule(
      await this.http.request(`/recurring-request-schedules/${id}`, { signal }),
    );
  }
  async create(payload) {
    return new RecurringSchedule(
      await this.http.request("/recurring-request-schedules", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  }
  async pause(schedule) {
    return new RecurringSchedule(
      await this.http.request(`/recurring-request-schedules/${schedule.id}/pause`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: schedule.version }),
      }),
    );
  }
}
