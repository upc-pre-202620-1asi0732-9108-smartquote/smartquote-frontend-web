import { Quotation } from "../domain/quotation.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";
export class QuotationService {
  constructor(repository) {
    this.repository = repository;
  }
  list(id, signal) {
    return this.repository.list(id, signal);
  }
  get(id) {
    return this.repository.get(id);
  }
  upload(id, supplier, file) {
    Quotation.validateUpload(supplier, file);
    return this.repository.upload(id, supplier, file);
  }
  process(id) {
    return this.repository.process(id);
  }
  correct(quote, fieldId, value, reason) {
    const field = quote.fields.find((f) => f.fieldId === fieldId);
    requireCondition(
      field && Quotation.editable(field.fieldPath),
      "fieldReadOnly",
    );
    requireCondition(reason.trim(), "reasonRequired");
    return this.repository.correct(quote, fieldId, String(value), reason);
  }
  addSpecification(quote, lineId, data) {
    requireCondition(quote.lines.some((line) => line.lineId === lineId), "mappingRequired");
    requireCondition(data.name.trim() && data.value.trim() && data.sourceTextReference.trim() &&
      data.reason.trim() && Number(data.sourcePageNumber) > 0, "invalidRequirement");
    return this.repository.addSpecification(quote, lineId, data);
  }
  confirm(quote, mappings) {
    new Quotation(quote).assertMappings(mappings);
    return this.repository.confirm(quote, mappings);
  }
}
