import { describe, expect, it } from "vitest";
import { toBigIntSafe } from "@/lib/genlayer/writes";
import { describeWriteFailure } from "./write-errors";
import { extractRawErrorText } from "@/lib/genlayer/errors";
import { validateAppeal } from "./appeal-validation";

describe("toBigIntSafe (fee handling)", () => {
  it("converts string amounts without precision loss (up to 10^24 wei)", () => {
    expect(toBigIntSafe("1000000000000000000000000")).toBe(
      1000000000000000000000000n,
    );
  });

  it("handles small numbers and bigints", () => {
    expect(toBigIntSafe(0)).toBe(0n);
    expect(toBigIntSafe(42)).toBe(42n);
    expect(toBigIntSafe(7n)).toBe(7n);
  });
});

describe("describeWriteFailure (contract error language)", () => {
  function envelope(errText: string) {
    return {
      message: "Missing or invalid parameters.",
      cause: {
        code: -32000,
        message: "execution failed",
        data: {
          receipt: {
            execution_result: "ERROR",
            result: Buffer.from(`\u0001${errText}`).toString("base64"),
          },
        },
      },
    };
  }

  it("maps known contract codes to human language", () => {
    const result = describeWriteFailure(envelope("ERR:PROTOCOL_PAUSED"));
    expect(result.primary).toContain("paused by protocol governance");
    expect(result.raw).toBe("ERR:PROTOCOL_PAUSED");
  });

  it("maps exact-fee rejections to a recovery path", () => {
    const result = describeWriteFailure(envelope("ERR:INCORRECT_FEE"));
    expect(result.primary).toContain("exact configured amount");
  });

  it("maps respondent addressing mistakes", () => {
    const result = describeWriteFailure(
      envelope("ERR:RESPONDENT_ADDRESS_MALFORMED - 'zzz' is not a valid address format"),
    );
    expect(result.primary).toContain("not a valid blockchain address");
  });

  it("treats wallet rejection as a retryable non-event", () => {
    const result = describeWriteFailure(new Error("User rejected the request."));
    expect(result.primary).toContain("was not signed");
    expect(result.raw).toBeNull();
  });

  it("falls back honestly for unknown contract rejections", () => {
    const result = describeWriteFailure(envelope("ERR:SOMETHING_NEW"));
    expect(result.primary).toContain("The protocol rejected this transaction.");
    expect(result.raw).toBe("ERR:SOMETHING_NEW");
  });

  it("falls back for unrelated technical failures", () => {
    const result = describeWriteFailure(new Error("network timeout"));
    expect(result.primary).toContain("Nothing was changed");
    expect(result.raw).toContain("network timeout");
  });
});

describe("appeal validation (contract-mirrored)", () => {
  const validDraft = {
    groundType: "NEW_EVIDENCE",
    explanation:
      "A signed delivery receipt from the courier exists and was not available during the first round.",
    specific:
      "It was only released by the courier service this week, after the original deadline.",
    impact:
      "It establishes the delivery date, contradicting the late-delivery finding.",
    precedentIds: [],
    externalUrls: [],
  };

  it("accepts a substantive appeal that meets every per-ground minimum", () => {
    expect(validateAppeal(validDraft)).toEqual({});
  });

  it("requires a known ground type", () => {
    const result = validateAppeal({ ...validDraft, groundType: "I_JUST_DISAGREE" });
    expect(result.groundType).toContain("four appeal grounds");
  });

  it("enforces the contract's per-field minimums (80/60/40)", () => {
    const short = validateAppeal({
      ...validDraft,
      explanation: "too short",
      specific: "also short",
      impact: "short",
    });
    expect(short.explanation).toContain("at least 80");
    expect(short.specific).toContain("at least 60");
    expect(short.impact).toContain("at least 40");
  });

  it("enforces the 500-character maximums", () => {
    const long = validateAppeal({
      ...validDraft,
      explanation: "x".repeat(501),
    });
    expect(long.explanation).toContain("limited to 500");
  });

  it("rejects malformed precedent ids and over-limit citations", () => {
    const bad = validateAppeal({
      ...validDraft,
      precedentIds: ["not-a-case"],
      externalUrls: ["http://insecure.example"],
    });
    expect(bad.precedentIds).toContain("MT-");
    expect(bad.externalUrls).toContain("https://");
    const many = validateAppeal({
      ...validDraft,
      precedentIds: Array.from({ length: 6 }, (_, i) => `MT-0000000${i}-aaaaaaaa`),
    });
    expect(many.precedentIds).toContain("At most 5");
  });
});

describe("extractRawErrorText (diagnostic fallback)", () => {
  it("walks the cause chain and collects viem fragments", () => {
    const error = {
      message: "Missing or invalid parameters.",
      cause: {
        code: -32000,
        message: "execution failed",
        details: "chain 1 does not match 61997",
        data: { message: "wallet refused the transaction" },
      },
    };
    const text = extractRawErrorText(error);
    expect(text).toContain("Missing or invalid parameters.");
    expect(text).toContain("execution failed");
    expect(text).toContain("chain 1 does not match 61997");
    expect(text).toContain("wallet refused the transaction");
  });

  it("decodes base64 receipt fragments without requiring ERR codes", () => {
    const error = {
      cause: {
        data: {
          receipt: {
            result: Buffer.from("plain runtime failure text").toString("base64"),
          },
        },
      },
    };
    expect(extractRawErrorText(error)).toContain("plain runtime failure text");
  });

  it("returns null for empty error objects", () => {
    expect(extractRawErrorText({})).toBeNull();
  });
});
