import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

// US14/E1-E3: interfaz con contrato controlado; no prueba persistencia.
test("US14 E1 E2 E3 — manager filters metrics and sees unavailable indicators without fabricated values", async ({ page }) => {
  await page.route("http://localhost:8080/api/v1/iam/auth/refresh", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.route("http://localhost:8080/api/v1/iam/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "local-ui-test-token",
        expiresIn: 3600,
        user: { userId: "local-ui-test", displayName: "Test manager", roles: ["PurchaseManager"] },
      }),
    }));
  const periods = [];
  await page.route("http://localhost:8080/api/v1/purchasing-metrics?*", (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    periods.push({ from, to });
    const filtered = from === "2026-09-01" && to === "2026-09-30";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        from, to, timeZone: "UTC", orderStatus: "Issued",
        orderCount: filtered ? 2 : 0,
        timeSampleCount: filtered ? 2 : 0,
        averageProcessingHours: filtered ? 24.5 : null,
        savingsSampleCount: filtered ? 1 : 0,
        comparativeSavings: filtered ? 20 : null,
        savingsCurrency: "PEN",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page.getByLabel("Password").fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Purchasing metrics" }).click();
  await expect(page.getByTestId("average-processing-hours")).toHaveText("Not available");
  await expect(page.getByTestId("comparative-savings")).toHaveText("Not available");

  await page.getByLabel("From").fill("2026-09-01");
  await page.getByLabel("To").fill("2026-09-30");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByTestId("average-processing-hours")).toContainText("24.5");
  await expect(page.getByTestId("comparative-savings")).toContainText("20");
  expect(periods.at(-1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
});

test("@optional-live US14 — manager sees persisted metrics from a local API", async ({ page }) => {
  test.skip(
    process.env.SMARTQUOTE_E2E_METRICS_REAL !== "1" || !process.env.SMARTQUOTE_JWT_KEY_FILE,
    "Requires the dedicated local API, test database and JWT signing key",
  );
  const key = readFileSync(process.env.SMARTQUOTE_JWT_KEY_FILE, "utf8").trim();
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const signed = [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({ sub: "10000000-0000-0000-0000-000000000001", role: "PurchaseManager",
      iss: "SmartQuote", aud: "SmartQuote.Clients", iat: now, nbf: now - 5, exp: now + 3600 }),
  ].join(".");
  const accessToken = signed + "." + createHmac("sha256", key).update(signed).digest("base64url");

  await page.route("http://localhost:8080/api/v1/iam/auth/refresh", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.route("http://localhost:8080/api/v1/iam/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken, expiresIn: 3600,
        user: { userId: "10000000-0000-0000-0000-000000000001", displayName: "Test manager",
          roles: ["PurchaseManager"] } }),
    }));

  await page.goto("/");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page.getByLabel("Password").fill("local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Purchasing metrics" }).click();
  await expect(page.getByTestId("average-processing-hours")).toBeVisible();

  await page.getByLabel("To").fill("2099-01-31");
  await page.getByLabel("From").fill("2099-01-01");
  const [emptyResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/purchasing-metrics?from=2099-01-01")),
    page.getByRole("button", { name: "Apply filters" }).click(),
  ]);
  expect(emptyResponse.status()).toBe(200);
  await expect(page.getByTestId("average-processing-hours")).toHaveText("Not available");
  await expect(page.getByTestId("comparative-savings")).toHaveText("Not available");

  const utcToday = new Date().toISOString().slice(0, 10);
  const utcMonthStart = utcToday.slice(0, 8) + "01";
  await page.getByLabel("From").fill(utcMonthStart);
  await page.getByLabel("To").fill(utcToday);
  const [dataResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/purchasing-metrics?from=${utcMonthStart}`)),
    page.getByRole("button", { name: "Apply filters" }).click(),
  ]);
  expect(dataResponse.status()).toBe(200);
  const metrics = await dataResponse.json();
  expect(metrics.timeSampleCount).toBeGreaterThan(0);
  expect(metrics.savingsSampleCount).toBeGreaterThan(0);
  await expect(page.getByTestId("average-processing-hours")).not.toHaveText("Not available");
  await expect(page.getByTestId("comparative-savings")).not.toHaveText("Not available");
});
