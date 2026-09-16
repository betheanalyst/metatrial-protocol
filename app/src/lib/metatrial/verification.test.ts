import { describe, expect, it } from "vitest";
import {
  detectVerificationMode,
  finalityDisplay,
} from "./verification";
import { toVerifiedAttestation } from "./mappers";
import type { RegistryAttestationRaw } from "./types";

describe("detectVerificationMode", () => {
  it("routes attestation ids, case ids, and external references", () => {
    expect(detectVerificationMode("MT-ATTEST-00000001-1a2b3c4d")).toBe(
      "attestation",
    );
    expect(detectVerificationMode("MT-00000012-1a2b3c4d")).toBe("case");
    expect(detectVerificationMode("platform-case-8842")).toBe("external");
  });
});

describe("finalityDisplay (tri-state translation)", () => {
  it("presents INDEXED as final and verified", () => {
    const display = finalityDisplay("INDEXED");
    expect(display.tone).toBe("final");
    expect(display.label).toContain("Verified");
  });

  it("never presents FINAL_PENDING_MIRROR as non-final", () => {
    const display = finalityDisplay("FINAL_PENDING_MIRROR");
    expect(display.tone).toBe("pending");
    expect(display.label.startsWith("Final")).toBe(true);
    expect(display.description).toContain("still synchronizing");
  });

  it("presents NOT_FINAL honestly", () => {
    const display = finalityDisplay("NOT_FINAL");
    expect(display.label).toBe("Not final");
  });

  it("falls back honestly for unknown states", () => {
    const display = finalityDisplay("SOMETHING_ELSE" as never);
    expect(display.label).toBe("Unknown state");
  });
});

describe("toVerifiedAttestation (revocation-aware)", () => {
  const base = {
    attestation_id: "MT-ATTEST-00000001-1a2b3c4d",
    dispute_id: "MT-00000012-1a2b3c4d",
    ruling: "CLAIMANT_PREVAILS",
    ruling_code: 0,
    confidence: 82,
    primary_finding: "CONTRACT_BREACH",
    finding_group: "GROUP_CLAIMANT_SUPPORTED",
    remedy_type: "PARTIAL_PAYMENT",
    remedy_detail: "",
    appeal_rounds_used: 2,
    respondent_participated: true,
    cl_evidence_integrity: true,
    resp_evidence_integrity: true,
    issued_at: 1789900000,
    external_ref: "platform-case-8842",
    basis_of_determination: "EVIDENCE BASIS ONLY.",
    is_revoked: false,
    revoke_reason: "",
    is_valid: true,
  };

  it("reports registry-valid attestations as valid", () => {
    const attestation = toVerifiedAttestation({
      ...base,
      registry_is_revoked: false,
      registry_revoke_reason: "",
    } satisfies RegistryAttestationRaw);
    expect(attestation.isValid).toBe(true);
    expect(attestation.rulingCode).toBe(0);
    expect(attestation.rulingLabel).toBe("Claimant prevails");
  });

  it("surfaces registry revocation and its reason", () => {
    const attestation = toVerifiedAttestation({
      ...base,
      registry_is_revoked: true,
      registry_revoke_reason: "Issued in error",
      is_valid: false,
    } satisfies RegistryAttestationRaw);
    expect(attestation.isValid).toBe(false);
    expect(attestation.registryRevoked).toBe(true);
    expect(attestation.registryRevokeReason).toBe("Issued in error");
  });

  it("treats core-side revocation claims with registry authority", () => {
    // Core's is_revoked can never become true in practice; the registry's
    // combined is_valid is the authoritative signal either way.
    const attestation = toVerifiedAttestation({
      ...base,
      is_revoked: true,
      is_valid: false,
      registry_is_revoked: false,
      registry_revoke_reason: "",
    } satisfies RegistryAttestationRaw);
    expect(attestation.isValid).toBe(false);
  });
});
