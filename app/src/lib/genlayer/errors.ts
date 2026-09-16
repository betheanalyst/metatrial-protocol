/**
 * Contract error translation - decoupled from the GenLayer client so it can
 * be unit-tested and reused across read and (future) write flows.
 *
 * Confirmed live against Studio Devnet: contract UserErrors (gl.vm.UserError)
 * surface as base64 text at error.cause.data.receipt.result, with a leading
 * control character, e.g. "ERR:DISPUTE_NOT_FOUND".
 */

export class ContractReadError extends Error {
  readonly contractMessage: string;

  constructor(contractMessage: string) {
    super(contractMessage.trim());
    this.name = "ContractReadError";
    this.contractMessage = contractMessage.trim();
  }

  /** The stable ERR:* code, e.g. "ERR:DISPUTE_NOT_FOUND". */
  get code(): string {
    const match = this.contractMessage.match(/ERR:[A-Z_]+/);
    return match === null ? "ERR:UNKNOWN" : match[0];
  }
}

function decodeBase64Text(value: string): string | null {
  try {
    const decoded = globalThis.atob(value);
    const printable = decoded.replace(/[^\x20-\x7E\n\r\t]/g, "").trim();
    return printable === "" ? null : printable;
  } catch {
    return null;
  }
}

/** Extract the contract-level message from a thrown SDK/RPC error. */
export function extractContractMessage(error: unknown): string | null {
  let current: unknown = error;
  let depth = 0;
  while (current !== null && current !== undefined && depth < 6) {
    const record = current as {
      data?: { receipt?: { result?: unknown }; message?: unknown };
      message?: unknown;
      details?: unknown;
      shortMessage?: unknown;
      cause?: unknown;
    };
    const candidates: unknown[] = [
      record.data?.receipt?.result,
      record.data?.message,
      record.message,
      record.details,
      record.shortMessage,
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== "string" || candidate.trim() === "") {
        continue;
      }
      if (candidate.includes("ERR:")) {
        return candidate;
      }
      const decoded = decodeBase64Text(candidate);
      if (decoded !== null && decoded.includes("ERR:")) {
        return decoded;
      }
    }
    current = record.cause;
    depth += 1;
  }
  return null;
}

/**
 * Diagnostic extraction: walk the error cause chain and collect every
 * human-readable fragment (including base64-decoded receipt results),
 * for surfacing in technical details when no contract ERR code is found.
 */
export function extractRawErrorText(error: unknown): string | null {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current !== null && current !== undefined && depth < 6) {
    const record = current as {
      data?: { receipt?: { result?: unknown }; message?: unknown };
      message?: unknown;
      details?: unknown;
      shortMessage?: unknown;
      cause?: unknown;
    };
    for (const candidate of [
      record.data?.receipt?.result,
      record.data?.message,
      record.message,
      record.details,
      record.shortMessage,
    ]) {
      if (typeof candidate !== "string" || candidate.trim() === "") {
        continue;
      }
      let text: string;
      if (candidate.includes("ERR:")) {
        text = candidate;
      } else if (
        // Only attempt a base64 decode on strings that actually look like
        // base64: plain phrases ("execution failed") are valid atob input
        // after whitespace-stripping and would decode to garbage.
        candidate.length >= 8 &&
        candidate.includes(" ") === false &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(candidate) === true &&
        (extractRawErrorTextHasMixedCase(candidate) || candidate.includes("="))
      ) {
        text = decodeBase64Text(candidate) ?? candidate;
      } else {
        text = candidate;
      }
      if (parts.includes(text) === false) {
        parts.push(text);
      }
    }
    current = record.cause;
    depth += 1;
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" | ").slice(0, 400);
}

function extractRawErrorTextHasMixedCase(candidate: string): boolean {
  const hasLower = /[a-z]/.test(candidate);
  const hasUpper = /[A-Z]/.test(candidate);
  const hasDigit = /[0-9]/.test(candidate);
  return (hasLower && hasUpper) || (hasUpper && hasDigit);
}
