// US17: a preventive alert for one quotation, expiry date and lead time.
export class ExpiryAlert {
  constructor(data, today = new Date().toLocaleDateString("en-CA")) {
    Object.assign(this, data);
    this.today = today;
  }
  // Whole days between today and the last valid day; 0 means it expires today.
  get daysLeft() {
    const day = (iso) => Date.UTC(...iso.split("-").map((part, i) => part - (i === 1)));
    return Math.round((day(this.validUntil) - day(this.today)) / 86400000);
  }
  // An offer is still valid during its last day and expired from the next one.
  get expired() {
    return this.daysLeft < 0;
  }
}
