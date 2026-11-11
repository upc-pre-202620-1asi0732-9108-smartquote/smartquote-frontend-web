import { requireCondition } from "../../shared/domain/domain-error.js";
import { RequestDraft } from "./purchase-request.entity.js";
const wholeDays = (value, min) =>
  Number.isInteger(value) && value >= min && value <= 3650;
// US16: a schedule generates drafts for review; it never submits requests or issues orders.
export class RecurringSchedule {
  constructor(data) {
    Object.assign(this, data);
    this.items = data.items ?? [];
    this.occurrences = data.occurrences ?? [];
  }
  get title() {
    return this.items[0]?.description ?? "";
  }
}
export class ScheduleDraft {
  constructor(data) {
    this.startDate = data.startDate;
    this.intervalDays = data.intervalDays;
    this.requiredDateOffsetDays = data.requiredDateOffsetDays;
    this.timeZoneId = data.timeZoneId;
    this.priority = data.priority;
    this.items = data.items;
  }
  validate(today) {
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(this.startDate ?? "") && this.startDate >= today,
      "scheduleStart",
    );
    requireCondition(wholeDays(this.intervalDays, 1), "scheduleInterval");
    requireCondition(wholeDays(this.requiredDateOffsetDays, 0), "scheduleOffset");
    requireCondition((this.timeZoneId ?? "").trim().length > 0, "scheduleTimeZone");
    // Items and requirements follow the same rules as a regular request.
    const { priority, items } = new RequestDraft({
      requiredDate: this.startDate,
      priority: this.priority,
      items: this.items,
    }).validate();
    return {
      startDate: this.startDate,
      intervalDays: this.intervalDays,
      requiredDateOffsetDays: this.requiredDateOffsetDays,
      timeZoneId: this.timeZoneId.trim(),
      priority,
      items,
    };
  }
}
