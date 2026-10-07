import test from "node:test";
import assert from "node:assert/strict";
import {
  isDisplayNameValid,
  isPasswordValid,
  passwordRules,
} from "../../src/identity/domain/registration.entity.js";
import { RegistrationService } from "../../src/identity/application/registration.service.js";
import { ApiError } from "../../src/shared/infrastructure/http-client.js";

const email = "ana.lopez@smartquote.local";
const strong = "Granja-Norte-2026!";

// US09 E1: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E1 — password policy accepts a password that meets every rule", () => {
  assert.equal(isPasswordValid(strong, email), true);
});

// US09 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E2 — password policy reports each rule that a weak password breaks", () => {
  const rules = passwordRules("short", email);
  assert.equal(rules.length, false);
  assert.equal(rules.upper, false);
  assert.equal(rules.digit, false);
  assert.equal(rules.symbol, false);
  assert.equal(rules.lower, true);
});

// US09 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E2 — password policy rejects a password containing the email name", () => {
  assert.equal(isPasswordValid("ANA.lopez-2026!", email), false);
});

// US09 E1: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E1 — registration service sends a trimmed payload and returns the account state", async () => {
  let sent;
  const service = new RegistrationService({
    register: async (payload) => {
      sent = payload;
      return { email: payload.email, status: "Pending", initialSetup: false };
    },
  });
  const result = await service.register({
    email: "  ana.lopez@smartquote.local ",
    displayName: " Ana López ",
    password: strong,
    role: "PurchaseAnalyst",
  });
  assert.deepEqual(sent, {
    email: "ana.lopez@smartquote.local",
    displayName: "Ana López",
    password: strong,
    role: "PurchaseAnalyst",
  });
  assert.deepEqual(result, {
    email: "ana.lopez@smartquote.local",
    status: "Pending",
    initialSetup: false,
  });
});

// US09 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E2 — registration service rejects a weak password before calling the API", async () => {
  let calls = 0;
  const service = new RegistrationService({
    register: async () => {
      calls++;
    },
  });
  await assert.rejects(
    service.register({
      email,
      displayName: "Ana",
      password: "weak",
      role: "PurchaseAnalyst",
    }),
    { code: "passwordPolicy" },
  );
  assert.equal(calls, 0);
});

// US09 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E2 — registration service rejects an unknown role before calling the API", async () => {
  const service = new RegistrationService({ register: async () => {} });
  await assert.rejects(
    service.register({
      email,
      displayName: "Ana",
      password: strong,
      role: "Administrator",
    }),
    { code: "invalidRole" },
  );
});

// US09 E3: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E3 — server errors keep their code so the form can show the right message", async () => {
  const service = new RegistrationService({
    register: async () => {
      throw new ApiError(409, "emailTaken", "Email is already registered.");
    },
  });
  await assert.rejects(
    service.register({
      email,
      displayName: "Ana",
      password: strong,
      role: "PurchaseAnalyst",
    }),
    { code: "emailTaken", status: 409 },
  );
});

// US09 E1: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E1 — display name accepts real names with accents, spaces, apostrophes and hyphens", () => {
  for (const name of ["Ana López", "María-José O'Brien", "Jhon Danny Guerrero Vasquez"]) {
    assert.equal(isDisplayNameValid(name), true, name);
  }
});

// US09 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E2 — display name rejects numbers, negative values and symbols", () => {
  for (const name of ["-5", "123", "Ana 2", "Ana@", "A", "   "]) {
    assert.equal(isDisplayNameValid(name), false, name);
  }
});

// US09 E2: validación o contrato del cliente; los dobles no prueban persistencia.
test("US09 E2 — registration service rejects a numeric display name before calling the API", async () => {
  let calls = 0;
  const service = new RegistrationService({
    register: async () => {
      calls++;
    },
  });
  await assert.rejects(
    service.register({
      email,
      displayName: "-5",
      password: strong,
      role: "PurchaseAnalyst",
    }),
    { code: "displayNameInvalid" },
  );
  assert.equal(calls, 0);
});
