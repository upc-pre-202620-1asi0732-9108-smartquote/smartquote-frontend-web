import { PurchaseRequest } from "../domain/purchase-request.entity.js";
export const toPurchaseRequest = (dto) => new PurchaseRequest(dto);
export const toRequestPage = (dto) => ({
  ...dto,
  items: dto.items.map(toPurchaseRequest),
});
