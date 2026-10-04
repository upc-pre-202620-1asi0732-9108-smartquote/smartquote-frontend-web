import test from "node:test";
import assert from "node:assert/strict";
import { RegistrationApprovalService } from "../../src/identity/application/registration-approval.service.js";

test("approval sends the chosen role for a pending account", async () => {
  let sent;
  const service = new RegistrationApprovalService({
    pending: async () => [],
    approve: async (userId, role) => {
      sent = { userId, role };
      return { userId };
    },
  });
  await service.approve("user-1", "PurchaseAnalyst");
  assert.deepEqual(sent, { userId: "user-1", role: "PurchaseAnalyst" });
});

test("approval rejects an unknown role before calling the API", async () => {
  let calls = 0;
  const service = new RegistrationApprovalService({
    pending: async () => [],
    approve: async () => {
      calls++;
    },
  });
  await assert.rejects(service.approve("user-1", "Administrator"), {
    code: "invalidRole",
  });
  assert.equal(calls, 0);
});

test("pending list is returned unchanged from the repository", async () => {
  const rows = [{ userId: "u", email: "a@b.co", requestedRole: "PurchaseAnalyst" }];
  const service = new RegistrationApprovalService({
    pending: async () => rows,
    approve: async () => {},
  });
  assert.deepEqual(await service.pending(), rows);
});
