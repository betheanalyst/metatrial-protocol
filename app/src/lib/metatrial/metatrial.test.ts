import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ContractReadError, extractContractMessage } from "@/lib/genlayer/errors";
import {
  parseDisputeId,
  parseExternalSources,
  parseKeyFindings,
  parsePrecedentsConsidered,
  splitCitations,
  splitExternalUrls,
  toAppealEntry,
  toAttestation,
  toCaseDetail,
  toCaseSummary,
  toDetermination,
} from "./mappers";
import {
  appealGroundLabel,
  categoryLabel,
  humanStatus,
  remedyLabel,
  rulingLabel,
} from "./labels";
import type { DisputeRaw, VerdictRaw } from "./types";

/** Fixtures mirror the exact view shapes verified against the contracts. */
const DISPUTE_FIXTURE: DisputeRaw = {
  dispute_id: "MT-00000012-1a2b3c4d",
  version: 11,
  claimant: "0xAbCdEf0000000000000000000000000000000001",
  respondent: "0x1234560000000000000000000000000000000002",
  participation_deadline: 1789500000,
  respondent_participated: false,
  title: "Partial delivery of a website build",
  category: "PAYMENT",
  dispute_context: "Freelance engagement for a marketing site.",
  external_ref: "platform-case-8842",
  claimant_statement: "The site was delivered late and incomplete.",
  claimant_ev_type: "INLINE_TEXT",
  claimant_ev_content: "Agreement dated 1 March, milestones listed.",
  claimant_ev_hash: "",
  precedent_citations: "MT-00000004-99998888,MT-00000007-aabbccdd",
  external_precedent_urls: "https://arweave.net/abc\nhttps://arweave.net/def",
  respondent_statement: "",
  respondent_ev_type: "",
  respondent_ev_hash: "",
  status: "PARTICIPATION_OPEN",
  appeal_round: 0,
  retry_count: 0,
  created_at: 1789300000,
  last_activity_at: 1789300000,
  finalized_at: 0,
  has_verdict: false,
  max_appeal_rounds_snapshot: 2,
  per_party_appeal_cap: 1,
  claimant_appeals_used: 0,
  respondent_appeals_used: 0,
  claimant_appeals_remaining: 1,
  respondent_appeals_remaining: 1,
  claimant_requested_skip_participation: false,
  claimant_requested_skip_appeal: false,
  respondent_consented_skip_participation: false,
  respondent_consented_skip_appeal: false,
  effective_skip_participation: false,
  effective_skip_appeal: false,
  claimant_agreed_to_resolve: false,
  respondent_agreed_to_resolve: false,
  attestation_id: "",
};

const VERDICT_FIXTURE: VerdictRaw = {
  ruling: "CLAIMANT_PREVAILS",
  ruling_code: 0,
  confidence: 82,
  primary_finding: "CONTRACT_BREACH",
  finding_group: "GROUP_CLAIMANT_SUPPORTED",
  claimant_evidence_quality: "STRONG",
  respondent_evidence_quality: "WEAK",
  cl_evidence_integrity: true,
  resp_evidence_integrity: false,
  key_findings:
    '{"f1":"Deliverable was partial.","f2":"Payments matched the completed portion.","f3":"Delay reasons unsupported."}',
  reasoning_summary: "The claimant account is consistent with the record.",
  recommended_resolution: {
    remedy_type: "PARTIAL_PAYMENT",
    remedy_detail: "Pay the completed milestone share.",
    percentage: 70,
    conditions: "Payable within 14 days of finalization.",
  },
  basis_of_determination: "EVIDENCE BASIS ONLY.",
  appeal_round: 1,
  retry_count: 0,
  rendered_at: 1789600000,
  raw_finding_verbatim: "raw finding",
  raw_remedy_verbatim: "raw remedy",
  precedents_considered: '[{"dispute_id":"MT-00000004-99998888"}]',
  external_sources_fetched:
    '[{"url":"https://arweave.net/abc","content_hash":"abc","fetch_ok":true,"fetched_at":1789600000}]',
  dispute_id: "MT-00000012-1a2b3c4d",
  status: "VERDICT_ISSUED",
  is_final: false,
  attestation_id: "",
};

describe("parseDisputeId", () => {
  it("extracts the case counter", () => {
    expect(parseDisputeId("MT-00000012-1a2b3c4d")).toBe("12");
    expect(parseDisputeId("MT-00001042-ffffffff")).toBe("1042");
  });

  it("returns null for malformed ids", () => {
    expect(parseDisputeId("not-a-case")).toBeNull();
    expect(parseDisputeId("MT-12-1a2b3c4d")).toBeNull();
  });
});

describe("json-in-string fields", () => {
  it("parses key findings in f1, f2, f3 order", () => {
    expect(parseKeyFindings(VERDICT_FIXTURE.key_findings)).toEqual([
      "Deliverable was partial.",
      "Payments matched the completed portion.",
      "Delay reasons unsupported.",
    ]);
  });

  it("tolerates empty and malformed json", () => {
    expect(parseKeyFindings("")).toEqual([]);
    expect(parseKeyFindings("not json")).toEqual([]);
    expect(parsePrecedentsConsidered("[]")).toEqual([]);
    expect(parseExternalSources("")).toEqual([]);
  });

  it("parses precedents and external sources", () => {
    expect(parsePrecedentsConsidered(VERDICT_FIXTURE.precedents_considered)).toEqual([
      { disputeId: "MT-00000004-99998888" },
    ]);
    expect(parseExternalSources(VERDICT_FIXTURE.external_sources_fetched)).toEqual([
      {
        url: "https://arweave.net/abc",
        contentHash: "abc",
        fetchOk: true,
        fetchedAt: 1789600000,
      },
    ]);
  });

  it("splits joined citation strings", () => {
    expect(splitCitations(DISPUTE_FIXTURE.precedent_citations)).toEqual([
      "MT-00000004-99998888",
      "MT-00000007-aabbccdd",
    ]);
    expect(splitExternalUrls(DISPUTE_FIXTURE.external_precedent_urls)).toEqual([
      "https://arweave.net/abc",
      "https://arweave.net/def",
    ]);
  });
});

describe("human status translation", () => {
  it("maps protocol statuses to human labels", () => {
    expect(humanStatus("PARTICIPATION_OPEN").label).toBe("Waiting for participation");
    expect(humanStatus("VERDICT_ISSUED").label).toBe("Decision issued");
    expect(humanStatus("FINALIZED").label).toBe("Final determination");
    expect(humanStatus("ABANDONED").label).toBe("Withdrawn");
    expect(humanStatus("RESOLVED_BY_AGREEMENT").label).toBe(
      "Resolved by both parties",
    );
  });

  it("addresses the respondent directly when they view an open case", () => {
    expect(humanStatus("PARTICIPATION_OPEN", "respondent").label).toBe(
      "Your response is needed",
    );
    expect(humanStatus("PARTICIPATION_OPEN", "claimant").label).toBe(
      "Waiting for participation",
    );
  });

  it("falls back honestly for unknown states", () => {
    const status = humanStatus("SOMETHING_NEW");
    expect(status.label).toBe("Unknown state");
    expect(status.key).toBe("SOMETHING_NEW");
  });
});

describe("labels", () => {
  it("translates controlled vocabularies", () => {
    expect(rulingLabel("CLAIMANT_PREVAILS")).toBe("Claimant prevails");
    expect(rulingLabel("INCONCLUSIVE_FINAL")).toBe("Inconclusive (final)");
    expect(categoryLabel("INTELLECTUAL_PROPERTY")).toBe("Intellectual property");
    expect(remedyLabel("PARTIAL_PAYMENT")).toBe("Partial payment");
    expect(appealGroundLabel("EVIDENCE_INTEGRITY")).toBe("Evidence integrity");
  });

  it("passes unknown raw values through unchanged", () => {
    expect(rulingLabel("FUTURE_RULING")).toBe("FUTURE_RULING");
  });
});

describe("case mappers", () => {
  it("maps a summary", () => {
    const summary = toCaseSummary(DISPUTE_FIXTURE);
    expect(summary.caseNumber).toBe("12");
    expect(summary.categoryLabel).toBe("Payment");
    expect(summary.status.label).toBe("Waiting for participation");
  });

  it("maps detail with evidence content availability stated honestly", () => {
    const detail = toCaseDetail(DISPUTE_FIXTURE);
    expect(detail.claimantEvidence.contentAvailable).toBe(true);
    expect(detail.respondentEvidence.contentAvailable).toBe(false);
    expect(detail.respondentEvidence.typeLabel).toBe("No evidence submitted");
    expect(detail.precedentCitations).toHaveLength(2);
    expect(detail.attestationId).toBeNull();
  });

  it("maps a determination with resolution and integrity flags", () => {
    const determination = toDetermination(VERDICT_FIXTURE, true);
    expect(determination.rulingLabel).toBe("Claimant prevails");
    expect(determination.primaryFindingLabel).toBe("Contract breach");
    expect(determination.keyFindings).toHaveLength(3);
    expect(determination.resolution.percentage).toBe(70);
    expect(determination.resolution.remedyLabel).toBe("Partial payment");
    expect(determination.claimantIntegrity).toBe(true);
    expect(determination.respondentIntegrity).toBe(false);
    expect(determination.isCurrent).toBe(true);
  });

  it("maps appeal entries", () => {
    const appeal = toAppealEntry({
      appellant: "0xAbCdEf0000000000000000000000000000000001",
      round_number: 1,
      ground_type: "REASONING_DEFECT",
      explanation: "e",
      specific: "s",
      impact: "i",
      filed_at: 1789700000,
    });
    expect(appeal.groundLabel).toBe("Reasoning defect");
    expect(appeal.roundNumber).toBe(1);
  });

  it("maps attestations", () => {
    const attestation = toAttestation({
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
    });
    expect(attestation.rulingLabel).toBe("Claimant prevails");
    expect(attestation.appealRoundsUsed).toBe(2);
  });
});

describe("contract error translation", () => {
  const BASE64_ERR = Buffer.from("\u0001ERR:DISPUTE_NOT_FOUND").toString("base64");

  it("decodes the live error envelope (base64 receipt result)", () => {
    const error = {
      message: "Missing or invalid parameters.",
      cause: {
        code: -32000,
        message: "execution failed",
        data: {
          receipt: {
            execution_result: "ERROR",
            result: BASE64_ERR,
          },
        },
      },
    };
    expect(extractContractMessage(error)).toContain("ERR:DISPUTE_NOT_FOUND");
  });

  it("reads plain-text ERR codes when present", () => {
    expect(extractContractMessage(new Error("boom: ERR:NO_VERDICT_YET"))).toContain(
      "ERR:NO_VERDICT_YET",
    );
  });

  it("returns null for unrelated errors", () => {
    expect(extractContractMessage(new Error("network down"))).toBeNull();
  });

  it("exposes a stable code on ContractReadError", () => {
    const error = new ContractReadError("\u0001ERR:DISPUTE_NOT_FOUND");
    expect(error.code).toBe("ERR:DISPUTE_NOT_FOUND");
  });
});

const { primaryRead, alternativeRead } = vi.hoisted(() => ({
  primaryRead: vi.fn(),
  alternativeRead: vi.fn(),
}));

vi.mock("@/lib/genlayer/client", () => ({
  // The RPC pool the read adapter fails over across: primary first.
  getReadClients: () => [
    { readContract: primaryRead },
    { readContract: alternativeRead },
  ],
  getReadClient: () => ({ readContract: primaryRead }),
}));

describe("read adapter resilience (RPC retry + failover)", () => {
  beforeEach(() => {
    primaryRead.mockReset();
    alternativeRead.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("absorbs a transient blip on the primary and fails over to the alternative", async () => {
    const { getProtocolInfo } = await import("@/lib/genlayer/reads");
    primaryRead.mockRejectedValueOnce(new TypeError("fetch failed"));
    alternativeRead.mockResolvedValueOnce({ version: 11, total_disputes: 0 });

    const info = await getProtocolInfo();
    expect(info.version).toBe(11);
    expect(primaryRead).toHaveBeenCalledTimes(1);
    expect(alternativeRead).toHaveBeenCalledTimes(1);
  });

  it("normalizes JSON-string view results after failover", async () => {
    const { getDisputesByCategory } = await import("@/lib/genlayer/reads");
    primaryRead.mockRejectedValueOnce(new Error("read timed out after 12000ms"));
    alternativeRead.mockResolvedValueOnce(
      JSON.stringify(["MT-00000001-1a2b3c4d", "MT-00000002-1a2b3c4d"]),
    );

    const ids = await getDisputesByCategory("CONTRACT", 0, 2);
    expect(ids).toEqual(["MT-00000001-1a2b3c4d", "MT-00000002-1a2b3c4d"]);
  });

  it("gives up after bounded attempts and describes the outage honestly", async () => {
    const { getProtocolInfo } = await import("@/lib/genlayer/reads");
    primaryRead.mockRejectedValue(new TypeError("fetch failed"));
    alternativeRead.mockRejectedValue(new TypeError("fetch failed"));

    await expect(getProtocolInfo()).rejects.toThrow(/temporarily unreachable/);
    // Bounded: 3 attempts across the 2-endpoint pool (primary, alternative,
    // primary again) - not an unbounded retry storm.
    expect(primaryRead).toHaveBeenCalledTimes(2);
    expect(alternativeRead).toHaveBeenCalledTimes(1);
  });

  it("never retries deterministic contract errors", async () => {
    const { getProtocolInfo } = await import("@/lib/genlayer/reads");
    const BASE64_ERR = Buffer.from("\u0001ERR:DISPUTE_NOT_FOUND").toString("base64");
    primaryRead.mockRejectedValueOnce({
      message: "Missing or invalid parameters.",
      cause: {
        code: -32000,
        message: "execution failed",
        data: { receipt: { execution_result: "ERROR", result: BASE64_ERR } },
      },
    });

    const error = await getProtocolInfo().then(
      () => {
        throw new Error("expected rejection");
      },
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ContractReadError);
    expect((error as ContractReadError).code).toBe("ERR:DISPUTE_NOT_FOUND");
    expect(primaryRead).toHaveBeenCalledTimes(1);
    expect(alternativeRead).toHaveBeenCalledTimes(0);
  });
});
