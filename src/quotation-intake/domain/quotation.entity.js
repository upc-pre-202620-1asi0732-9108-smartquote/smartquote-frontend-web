import { requireCondition } from "../../shared/domain/domain-error.js";
export class Quotation {
  constructor(data) {
    Object.assign(this, data);
    this.lines = data.lines ?? [];
    this.fields = data.fields ?? [];
  }
  get verified() {
    return this.status === "Verified";
  }
  get total() {
    return this.lines.some((l) => l.quantity == null || l.unitPrice == null)
      ? null
      : this.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  }
  assertMappings(mappings) {
    requireCondition(
      this.lines.length > 0 && this.lines.every((l) => mappings[l.lineId]),
      "mappingRequired",
    );
  }
  static editable(path) {
    return /^(supplier\.(businessName|taxIdentifier)|validUntil|currency|deliveryLeadTimeDays|lines\[\d+\]\.(description|quantity|unitOfMeasure|unitPrice|specifications\[\d+\]\.value))$/.test(
      path,
    );
  }
  static validateUpload(supplier, file) {
    requireCondition(Object.keys(supplier).length === 3, "supplierRequired");
    requireCondition(
      file.size > 0 &&
        file.size <= 15 * 1024 * 1024 &&
        /\.pdf$/i.test(file.name),
      "pdfRequired",
    );
  }
}
