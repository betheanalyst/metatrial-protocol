import type { FinalityStatusRaw } from "@/lib/genlayer/reads";

/** Route/pattern detection for the public verification entry point. */
export type VerificationMode = "attestation" | "case" | "external";

export function detectVerificationMode(id: string): VerificationMode {
  if (id.startsWith("MT-ATTEST-")) {
    return "attestation";
  }
  if (/^MT-\d{8}-[0-9a-fA-F]{8}$/.test(id) === true) {
    return "case";
  }
  return "external";
}

export interface FinalityDisplay {
  label: string;
  description: string;
  tone: "final" | "pending" | "muted" | "danger";
}

/**
 * Human translation of the Registry tri-state. FINAL_PENDING_MIRROR must
 * never be presented as non-final (Foundation specification, state
 * integrity rules): the determination IS final - only the verification
 * index is still synchronizing.
 */
export function finalityDisplay(status: FinalityStatusRaw["status"]): FinalityDisplay {
  if (status === "INDEXED") {
    return {
      label: "Verified & indexed",
      description:
        "The final determination is recorded and indexed in the public attestation registry.",
      tone: "final",
    };
  }
  if (status === "FINAL_PENDING_MIRROR") {
    return {
      label: "Final - index synchronizing",
      description:
        "The determination is final on the protocol. The public verification index is still synchronizing and will catch up.",
      tone: "pending",
    };
  }
  if (status === "NOT_FINAL") {
    return {
      label: "Not final",
      description:
        "This case has no final determination on the protocol yet.",
      tone: "muted",
    };
  }
  return {
    label: "Unknown state",
    description: "The verification state could not be determined right now.",
    tone: "muted",
  };
}
