import { describe, expect, it } from "vitest";
import { base64ToBytes, invoicePdfErrorCopy, issuerInputOf } from "./invoice-pdf.util";

const gqlError = (extensions: Record<string, unknown>) => ({ graphQLErrors: [{ extensions }] });

describe("interim invoice PDF (backend PRD-030)", () => {
  it("decodes the server's base64 to the PDF bytes", () => {
    const bytes = base64ToBytes(btoa("%PDF-1.3"));
    expect(Array.from(bytes.slice(0, 5)).map((code) => String.fromCharCode(code)).join("")).toBe("%PDF-");
  });

  it("words each refusal (FR-6, FR-7)", () => {
    expect(invoicePdfErrorCopy(gqlError({ code: "CONFLICT", reason: "INVOICE_ISSUER_MISSING" }))).toMatch(/invoice issuer/);
    expect(invoicePdfErrorCopy(gqlError({ code: "BAD_USER_INPUT", reason: "RATE_LIMITED" }))).toMatch(/minute/);
    expect(invoicePdfErrorCopy(new Error("network"))).toMatch(/Couldn't create the PDF/);
  });

  it("sends the issuer as the server input: trimmed lines, blank optionals as null (FR-8)", () => {
    expect(
      issuerInputOf({ legalName: " Zerror Studios ", address: "1 Road\n\n Mumbai \n", email: "", phone: " 98 ", website: "" }),
    ).toEqual({ legalName: "Zerror Studios", addressLines: ["1 Road", "Mumbai"], email: null, phone: "98", website: null });
  });
});
