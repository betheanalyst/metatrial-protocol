import { isAddress, parseUnits, zeroAddress } from "viem";

/**
 * Proposal-creation validation, mirroring MetaTrialGovernance's
 * creation-time checks so admins get precise feedback before signing.
 * The contract remains authoritative (it re-validates everything and
 * also checks pending-duplicate/no-op conditions the client cannot see).
 */

export const PARAM_RANGES = {
  participation_window: { min: 3_600, max: 604_800 },
  appeal_window: { min: 3_600, max: 604_800 },
  max_appeal_rounds: { min: 1, max: 5 },
  confidence_tolerance: { min: 5, max: 30 },
  max_disputes_per_respondent_window: { min: 1, max: 100 },
  max_disputes_per_claimant_window: { min: 1, max: 200 },
} as const;

export const PROPOSAL_LIMITS = {
  feeMaxWei: 10n ** 24n,
  externalPrefixMin: 12,
  externalPrefixMax: 200,
  maxAdmins: 5,
  minAdminsPostBootstrap: 3,
} as const;

export type ProposalActionType =
  | "ADD_ADMIN"
  | "REMOVE_ADMIN"
  | "CORE_PARAM_UPDATE"
  | "TREASURY_UPDATE"
  | "EXTERNAL_SOURCE_UPDATE"
  | "PAUSE"
  | "UNPAUSE";

export interface ProposalDraft {
  actionType: ProposalActionType;
  targetAddress: string;
  params: {
    participation_window: number;
    appeal_window: number;
    max_appeal_rounds: number;
    confidence_tolerance: number;
    max_disputes_per_respondent_window: number;
    max_disputes_per_claimant_window: number;
  };
  filingFeeGen: string;
  bondGen: string;
  treasuryAddress: string;
  externalPrefix: string;
  externalActive: boolean;
}

/** Precision-safe GEN (18 decimals) -> wei, from a decimal string. */
export function parseGenToWei(gen: string): bigint | null {
  if (/^\d+(\.\d{1,18})?$/.test(gen) === false) {
    return null;
  }
  try {
    return parseUnits(gen, 18);
  } catch {
    return null;
  }
}

export interface CreationContext {
  admins: string[];
  activeAdminCount: number;
  bootstrapComplete: boolean;
  paused: boolean;
}

/** Returns per-field human error messages; empty object means valid. */
export function validateProposal(
  draft: ProposalDraft,
  context: CreationContext,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const type = draft.actionType;

  if (type === "ADD_ADMIN" || type === "REMOVE_ADMIN") {
    if (isAddress(draft.targetAddress) === false) {
      errors.targetAddress = "Enter a valid wallet address (0x\u2026).";
    } else if (type === "ADD_ADMIN") {
      if (
        context.admins.some(
          (admin) => admin.toLowerCase() === draft.targetAddress.toLowerCase(),
        )
      ) {
        errors.targetAddress = "That address already holds an admin seat.";
      } else if (context.activeAdminCount >= PROPOSAL_LIMITS.maxAdmins) {
        errors.targetAddress = `The admin seat cap is ${PROPOSAL_LIMITS.maxAdmins}.`;
      }
    } else {
      const isSeated = context.admins.some(
        (admin) => admin.toLowerCase() === draft.targetAddress.toLowerCase(),
      );
      if (isSeated === false) {
        errors.targetAddress = "That address does not currently hold an admin seat.";
      } else if (context.activeAdminCount <= PROPOSAL_LIMITS.minAdminsPostBootstrap) {
        errors.targetAddress = `At least ${PROPOSAL_LIMITS.minAdminsPostBootstrap} active admins must remain.`;
      }
    }
  }

  if (type === "CORE_PARAM_UPDATE") {
    for (const key of Object.keys(
      PARAM_RANGES,
    ) as Array<keyof typeof PARAM_RANGES>) {
      const range = PARAM_RANGES[key];
      const value = draft.params[key];
      if (value < range.min || value > range.max) {
        errors[`param_${key}`] = `Must be between ${range.min} and ${range.max}.`;
      }
    }
    if (
      errors.param_max_appeal_rounds === undefined &&
      draft.params.max_appeal_rounds % 2 !== 0
    ) {
      errors.param_max_appeal_rounds =
        "Must be even - the budget splits evenly between the two parties.";
    }
  }

  if (type === "TREASURY_UPDATE") {
    if (isAddress(draft.treasuryAddress) === false) {
      errors.treasuryAddress = "Enter a valid treasury address (0x\u2026).";
    } else if (draft.treasuryAddress.toLowerCase() === zeroAddress) {
      errors.treasuryAddress =
        "The zero address would silently burn every forfeited fee and bond.";
    }
    for (const [field, gen] of [
      ["filingFeeGen", draft.filingFeeGen],
      ["bondGen", draft.bondGen],
    ] as const) {
      const wei = parseGenToWei(gen === "" ? "0" : gen);
      if (wei === null) {
        errors[field] = "Enter an amount in GEN (e.g. 0 or 1.5).";
      } else if (wei > PROPOSAL_LIMITS.feeMaxWei) {
        errors[field] = "Amount exceeds the protocol maximum.";
      }
    }
  }

  if (type === "EXTERNAL_SOURCE_UPDATE") {
    const prefix = draft.externalPrefix.trim();
    if (
      prefix.length < PROPOSAL_LIMITS.externalPrefixMin ||
      prefix.length > PROPOSAL_LIMITS.externalPrefixMax
    ) {
      errors.externalPrefix = `The prefix must be ${PROPOSAL_LIMITS.externalPrefixMin} to ${PROPOSAL_LIMITS.externalPrefixMax} characters.`;
    } else if (/^https:\/\//.test(prefix) === false) {
      errors.externalPrefix = "Whitelisted sources use https:// prefixes.";
    }
  }

  if (type === "PAUSE" && context.paused === true) {
    errors.actionType = "The protocol is already paused.";
  }
  if (type === "UNPAUSE" && context.paused === false) {
    errors.actionType = "The protocol is not paused.";
  }

  return errors;
}
