import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function mintToken(role, key, options = {}) {
  if (
    !["ProductionSpecialist", "PurchaseAnalyst", "PurchaseManager"].includes(
      role,
    )
  )
    throw new Error("Unknown SmartQuote role.");
  if (!key || Buffer.byteLength(key) < 32)
    throw new Error(
      "Set SMARTQUOTE_JWT_KEY (at least 32 bytes), matching Jwt:SigningKey in your LOCAL backend.",
    );
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: options.userId ?? randomUUID(),
    role,
    iss: options.issuer ?? "SmartQuote",
    aud: options.audience ?? "SmartQuote.Clients",
    iat: now,
    nbf: now - 5,
    exp: now + (options.hours ?? 4) * 3600,
  };
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", key)
    .update(`${head}.${payload}`)
    .digest("base64url");
  return `${head}.${payload}.${signature}`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const get = (flag) => process.argv[process.argv.indexOf(flag) + 1];
  const role = process.argv.includes("--role")
    ? get("--role")
    : "PurchaseManager";
  const key = process.argv.includes("--key-file")
    ? readFileSync(get("--key-file"), "utf8").trim()
    : process.env.SMARTQUOTE_JWT_KEY;
  const token = mintToken(role, key, {
    issuer: process.env.SMARTQUOTE_JWT_ISSUER,
    audience: process.env.SMARTQUOTE_JWT_AUDIENCE,
    userId: process.env.SMARTQUOTE_USER_ID,
  });
  if (process.argv.includes("--out"))
    writeFileSync(get("--out"), token, { mode: 0o600 });
  else console.log(token);
}
