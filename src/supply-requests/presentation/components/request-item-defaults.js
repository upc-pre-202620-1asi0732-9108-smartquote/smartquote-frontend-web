export const newRequirement = () => ({
  name: "",
  operator: "Equals",
  expectedValue: "",
  unitOfMeasure: "",
  isMandatory: true,
});
export const newItem = () => ({
  description: "",
  quantity: 1,
  unitOfMeasure: "",
  requirements: [newRequirement()],
});
// Editable copy of persisted items: identifiers are assigned again by the API.
export const toEditableItems = (items) =>
  items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitOfMeasure: item.unitOfMeasure,
    requirements: item.requirements.map((r) => ({
      name: r.name,
      operator: r.operator,
      expectedValue: r.expectedValue,
      unitOfMeasure: r.unitOfMeasure ?? "",
      isMandatory: r.isMandatory,
    })),
  }));
export const isoDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
