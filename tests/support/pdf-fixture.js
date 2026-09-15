import { createHash, randomUUID } from "node:crypto";
const fixtureId = randomUUID();
function pdf(text) {
  const safe = text.replace(/[()\\]/g, " ");
  const stream = `BT /F1 14 Tf 50 750 Td (${safe}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((value, index) => {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${value}\nendobj\n`;
  });
  const start = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result);
}
export function fixture(name) {
  for (let n = 0; ; n++) {
    const buffer = pdf(
      `SmartQuote integration fixture ${name} ${fixtureId} ${n}`,
    );
    if (
      createHash("sha256")
        .update(buffer)
        .digest("hex")
        .slice(0, 8)
        .includes("a")
    )
      return new File([buffer], `${name}.pdf`, { type: "application/pdf" });
  }
}
