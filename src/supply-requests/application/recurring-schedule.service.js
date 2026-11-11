import { ScheduleDraft } from "../domain/recurring-schedule.entity.js";
export class RecurringScheduleService {
  constructor(repository, today = () => new Date().toLocaleDateString("en-CA")) {
    this.repository = repository;
    this.today = today;
  }
  list(signal) {
    return this.repository.list(signal);
  }
  get(id, signal) {
    return this.repository.get(id, signal);
  }
  create(data) {
    return this.repository.create(new ScheduleDraft(data).validate(this.today()));
  }
  pause(schedule) {
    return this.repository.pause(schedule);
  }
}
