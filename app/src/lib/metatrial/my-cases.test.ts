import { describe, expect, it } from "vitest";
import { caseStage, classifyMyCase } from "./my-cases";
import { toSettlement } from "./mappers";
import { formatGenAmount } from "@/lib/utils/format";
import type { CaseDetail } from "./types";

function makeDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: "MT-00000012-1a2b3c4d",
    caseNumber: "12",
    title: "t",
    categoryLabel: "Payment",
    status: { key: "PARTICIPATION_OPEN", label: "Waiting for participation", viewerLabel: null, description: "", tone: "pending" },
    claimant: "0xaaaa000000000000000000000000000000000001",
    respondent: "0xbbbb000000000000000000000000000000000002",
    createdAt: 1789300000,
    respondentParticipated: false,
    context: "",
    externalRef: "",
    lastActivityAt: 1789300000,
    finalizedAt: null,
    participation: {
      deadline: 1789500000,
      participated: false,
      requestedSkip: false,
      consentedSkip: false,
      effectiveSkip: false,
    },
    appealWaiver: { requested: false, consented: false, effective: false },
    appealBudget: {
      maxRounds: 2,
      perPartyCap: 1,
      claimantUsed: 0,
      respondentUsed: 0,
      claimantRemaining: 1,
      respondentRemaining: 1,
    },
    mutualResolution: { claimantAgreed: false, respondentAgreed: false },
    claimantStatement: "",
    respondentStatement: "",
    claimantEvidence: { party: "claimant", typeLabel: "Inline text", content: "", contentHash: "", contentAvailable: false },
    respondentEvidence: { party: "respondent", typeLabel: "No evidence submitted", content: null, contentHash: "", contentAvailable: false },
    precedentCitations: [],
    externalPrecedentUrls: [],
    hasVerdict: false,
    attestationId: null,
    ...overrides,
  };
}

const NOW = 1_789_400_000;
const baseContext = {
  nowSeconds: NOW,
  currentAppealRound: null as number | null,
  currentVerdictRenderedAt: null as number | null,
  appealWindowSeconds: 259_200,
};

describe("classifyMyCase (action-center classification)", () => {
  it("puts the silent respondent in needs-action", () => {
    const result = classifyMyCase("respondent", makeDetail(), baseContext);
    expect(result.bucket).toBe("needs-action");
    expect(result.actionLabel).toBe("Respond to this case");
  });

  it("lets the claimant start the review once the window closes (advisory)", () => {
    const detail = makeDetail({ participation: { deadline: NOW - 10, participated: false, requestedSkip: false, consentedSkip: false, effectiveSkip: false } });
    const result = classifyMyCase("claimant", detail, baseContext);
    expect(result.bucket).toBe("needs-action");
    expect(result.actionLabel).toBe("Start the review");
  });

  it("keeps the claimant waiting while the window is open", () => {
    const result = classifyMyCase("claimant", makeDetail(), baseContext);
    expect(result.bucket).toBe("active");
    expect(result.actionLabel).toBeNull();
  });

  it("flags finalize when the appeal budget is exhausted", () => {
    const detail = makeDetail({
      status: { key: "VERDICT_ISSUED", label: "Decision issued", viewerLabel: null, description: "", tone: "active" },
      hasVerdict: true,
      appealBudget: { maxRounds: 2, perPartyCap: 1, claimantUsed: 1, respondentUsed: 1, claimantRemaining: 0, respondentRemaining: 0 },
    });
    const result = classifyMyCase("claimant", detail, { ...baseContext, currentAppealRound: 2, currentVerdictRenderedAt: NOW });
    expect(result.bucket).toBe("needs-action");
    expect(result.actionLabel).toBe("Finalize the record");
  });

  it("keeps an open decision active while the appeal window runs", () => {
    const detail = makeDetail({
      status: { key: "VERDICT_ISSUED", label: "Decision issued", viewerLabel: null, description: "", tone: "active" },
      hasVerdict: true,
    });
    const result = classifyMyCase("respondent", detail, { ...baseContext, currentAppealRound: 0, currentVerdictRenderedAt: NOW });
    expect(result.bucket).toBe("active");
    expect(result.actionLabel).toBeNull();
  });

  it("files finalized cases under completed", () => {
    const detail = makeDetail({
      status: { key: "FINALIZED", label: "Final determination", viewerLabel: null, description: "", tone: "final" },
      finalizedAt: NOW,
      attestationId: "MT-ATTEST-00000001-1a2b3c4d",
    });
    const result = classifyMyCase("claimant", detail, baseContext);
    expect(result.bucket).toBe("completed");
  });
});

describe("toSettlement (BigInt-safe amounts)", () => {
  it("maps a raw settlement without precision loss", () => {
    const settlement = toSettlement({
      settlement_id: "STL-00000001",
      dispute_id: "MT-00000012-1a2b3c4d",
      purpose: "APPEAL_BOND_REFUND",
      recipient_hex: "0xaaaa000000000000000000000000000000000001",
      amount: "1000000000000000000000000",
      claim_status: "AUTHORIZED",
      authorized_at: 1789900000,
      delivered_at: 0,
      delivered_by_hex: "",
    });
    expect(settlement.amountWei).toBe(1000000000000000000000000n);
    expect(settlement.purposeLabel).toBe("Appeal bond refund");
    expect(settlement.deliveredAt).toBeNull();
  });
});

describe("formatGenAmount (wei to GEN display)", () => {
  it("renders zero", () => {
    expect(formatGenAmount(0n)).toBe("0 GEN");
  });

  it("renders whole GEN", () => {
    expect(formatGenAmount(5000000000000000000n)).toBe("5 GEN");
  });

  it("renders fractional GEN without pretending precision", () => {
    expect(formatGenAmount(1500000000000000000n)).toBe("1.5 GEN");
    expect(formatGenAmount(1234560000000000000n)).toBe("1.23456 GEN");
  });

  it("survives 10^24-scale amounts", () => {
    expect(formatGenAmount(1000000000000000000000000n)).toBe("1000000 GEN");
  });
});

describe("caseStage (flow-accurate status, the browser-reported scenarios)", () => {
  it("respondent who already submitted sees waiting-for-claimant, not response-needed", () => {
    const detail = makeDetail({
      respondentParticipated: true,
      participation: { deadline: NOW + 1000, participated: true, requestedSkip: false, consentedSkip: false, effectiveSkip: false },
    });
    const stage = caseStage(detail, "respondent", baseContext);
    expect(stage.label).toBe("Waiting for the claimant to start the review");
    expect(stage.actionLabel).toBeNull();
  });

  it("claimant sees Ready for review once the respondent has submitted", () => {
    const detail = makeDetail({
      respondentParticipated: true,
      participation: { deadline: NOW + 1000, participated: true, requestedSkip: false, consentedSkip: false, effectiveSkip: false },
    });
    const stage = caseStage(detail, "claimant", baseContext);
    expect(stage.label).toBe("Ready for review");
    expect(stage.actionLabel).toBe("Start the review");
  });

  it("respondent before responding still sees the response call-to-action", () => {
    const stage = caseStage(makeDetail(), "respondent", baseContext);
    expect(stage.label).toBe("Your response is needed");
    expect(stage.actionLabel).toBe("Respond to this case");
  });

  it("public viewers never see party actions", () => {
    const stage = caseStage(makeDetail(), "other", baseContext);
    expect(stage.label).toBe("Waiting for participation");
    expect(stage.actionLabel).toBeNull();
  });

  it("VERDICT_ISSUED within the window shows the appeal-open stage", () => {
    const detail = makeDetail({
      status: { key: "VERDICT_ISSUED", label: "Decision issued", viewerLabel: null, description: "", tone: "active" },
      hasVerdict: true,
    });
    const stage = caseStage(detail, "claimant", {
      ...baseContext,
      currentAppealRound: 0,
      currentVerdictRenderedAt: NOW,
    });
    expect(stage.label).toContain("appeal window open");
    expect(stage.actionLabel).toBeNull();
  });

  it("VERDICT_ISSUED after the window closes shows Ready to finalize", () => {
    const detail = makeDetail({
      status: { key: "VERDICT_ISSUED", label: "Decision issued", viewerLabel: null, description: "", tone: "active" },
      hasVerdict: true,
    });
    const stage = caseStage(detail, "claimant", {
      ...baseContext,
      currentAppealRound: 0,
      currentVerdictRenderedAt: NOW - 259_201,
    });
    expect(stage.label).toBe("Ready to finalize");
    expect(stage.actionLabel).toBe("Finalize the record");
  });
});
