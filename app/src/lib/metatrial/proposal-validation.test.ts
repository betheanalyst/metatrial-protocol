import { describe, expect, it } from "vitest";
import {
  parseGenToWei,
  validateProposal,
  type ProposalDraft,
} from "./proposal-validation";

const VALID_ADDRESS = "0x1111111111111111111111111111111111111111";
const context = {
  admins: [VALID_ADDRESS, "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333"],
  activeAdminCount: 3,
  bootstrapComplete: true,
  paused: false,
};

const validParamDraft = (): ProposalDraft => ({
  actionType: "CORE_PARAM_UPDATE",
  targetAddress: "",
  params: {
    participation_window: 172_800,
    appeal_window: 259_200,
    max_appeal_rounds: 2,
    confidence_tolerance: 15,
    max_disputes_per_respondent_window: 10,
    max_disputes_per_claimant_window: 20,
  },
  filingFeeGen: "0",
  bondGen: "0",
  treasuryAddress: "",
  externalPrefix: "",
  externalActive: true,
});

describe("parseGenToWei (precision-safe)", () => {
  it("parses decimal GEN to wei without float loss", () => {
    expect(parseGenToWei("1.5")).toBe(1500000000000000000n);
    expect(parseGenToWei("0")).toBe(0n);
    expect(parseGenToWei("1000000")).toBe(1000000000000000000000000n);
  });

  it("rejects malformed and negative input", () => {
    expect(parseGenToWei("abc")).toBeNull();
    expect(parseGenToWei("-1")).toBeNull();
    expect(parseGenToWei("1.2.3")).toBeNull();
  });
});

describe("validateProposal (contract-mirrored creation checks)", () => {
  it("accepts a valid in-range parameter update", () => {
    expect(validateProposal(validParamDraft(), context)).toEqual({});
  });

  it("enforces every parameter range", () => {
    const draft = validParamDraft();
    draft.params = {
      participation_window: 10,
      appeal_window: 700_000,
      max_appeal_rounds: 6,
      confidence_tolerance: 2,
      max_disputes_per_respondent_window: 0,
      max_disputes_per_claimant_window: 999,
    };
    const errors = validateProposal(draft, context);
    expect(Object.keys(errors)).toHaveLength(6);
  });

  it("requires even max appeal rounds (per-party split)", () => {
    const draft = validParamDraft();
    draft.params.max_appeal_rounds = 3;
    const errors = validateProposal(draft, context);
    expect(errors.param_max_appeal_rounds).toContain("even");
  });

  it("checks admin seats for add/remove", () => {
    const add = validateProposal(
      { ...validParamDraft(), actionType: "ADD_ADMIN", targetAddress: VALID_ADDRESS },
      context,
    );
    expect(add.targetAddress).toContain("already holds");
    const removeUnknown = validateProposal(
      { ...validParamDraft(), actionType: "REMOVE_ADMIN", targetAddress: "0x9999999999999999999999999999999999999999" },
      context,
    );
    expect(removeUnknown.targetAddress).toContain("does not currently hold");
    // With 3 admins (the minimum) a removal must be rejected; with 4 it passes.
    const removeOk = validateProposal(
      { ...validParamDraft(), actionType: "REMOVE_ADMIN", targetAddress: VALID_ADDRESS },
      { ...context, activeAdminCount: 4, admins: [...context.admins, "0x4444444444444444444444444444444444444444"] },
    );
    expect(removeOk.targetAddress).toBeUndefined();
  });

  it("rejects the zero treasury address (burn protection)", () => {
    const draft: ProposalDraft = {
      ...validParamDraft(),
      actionType: "TREASURY_UPDATE",
      treasuryAddress: "0x0000000000000000000000000000000000000000",
      filingFeeGen: "1",
      bondGen: "1",
    };
    const errors = validateProposal(draft, context);
    expect(errors.treasuryAddress).toContain("burn");
  });

  it("rejects pause proposals when already paused", () => {
    const errors = validateProposal(
      { ...validParamDraft(), actionType: "PAUSE" },
      { ...context, paused: true },
    );
    expect(errors.actionType).toContain("already paused");
  });

  it("validates the external source prefix length and scheme", () => {
    const short = validateProposal(
      { ...validParamDraft(), actionType: "EXTERNAL_SOURCE_UPDATE", externalPrefix: "https://x" },
      context,
    );
    expect(short.externalPrefix).toContain("12 to 200");
    const ok = validateProposal(
      { ...validParamDraft(), actionType: "EXTERNAL_SOURCE_UPDATE", externalPrefix: "https://arweave.net/" },
      context,
    );
    expect(ok.externalPrefix).toBeUndefined();
  });
});
