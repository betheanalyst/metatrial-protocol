import type { CalldataEncodable } from "genlayer-js/types";
import { CONTRACTS } from "../config/protocol";
import type {
  AppealEntryRaw,
  AttestationRaw,
  DisputeRaw,
  VerdictRaw,
} from "../metatrial/types";
import { getReadClient } from "./client";
import {
  ContractReadError,
  extractContractMessage,
} from "./errors";

export { ContractReadError, extractContractMessage } from "./errors";

/* ------------------------------------------------------------------ */
/* Read adapter - the only place talking to GenLayer contracts          */
/* ------------------------------------------------------------------ */

async function readView(
  address: string,
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<unknown> {
  const client = getReadClient();
  let result: unknown;
  try {
    result = await client.readContract({
      address: address as `0x${string}`,
      functionName,
      args,
      jsonSafeReturn: true,
    });
  } catch (error) {
    const contractMessage = extractContractMessage(error);
    if (contractMessage !== null) {
      throw new ContractReadError(contractMessage);
    }
    throw error;
  }
  // Some GenLayer view results arrive as JSON strings; normalize to objects.
  if (typeof result === "string") {
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }
  return result;
}

async function readCore(functionName: string, args: CalldataEncodable[] = []): Promise<unknown> {
  return readView(CONTRACTS.core, functionName, args);
}

async function readRegistry(functionName: string, args: CalldataEncodable[] = []): Promise<unknown> {
  return readView(CONTRACTS.attestationRegistry, functionName, args);
}

async function readGovernance(functionName: string, args: CalldataEncodable[] = []): Promise<unknown> {
  return readView(CONTRACTS.governance, functionName, args);
}

export interface ProtocolInfo {
  version: number;
  total_disputes: number;
  total_attestations: number;
  owner: string;
  registry_configured: boolean;
  auto_mirror_active: boolean;
  valid_categories: string[];
  valid_appeal_grounds: string[];
  valid_remedy_types: string[];
  immutable_url_prefixes: string[];
  valid_evidence_types: string[];
  governance: Record<string, number>;
  ruling_codes: Record<string, number>;
}

export interface GovernanceInfo {
  active_admin_count: number;
  bootstrap_complete: boolean;
  admins: string[];
  current_threshold: number | null;
  total_proposals: number;
  pending_proposals: number;
  paused: boolean;
  scope: string;
}

export interface RegistryInfo {
  owner: string;
  core_address: string;
  core_configured: boolean;
  total_registered: number;
  total_revoked: number;
  architecture: string;
}

/* ---------- Protocol / configuration views ---------- */

export async function getProtocolInfo(): Promise<ProtocolInfo> {
  return (await readCore("get_protocol_info")) as ProtocolInfo;
}

export async function getGovernanceInfo(): Promise<GovernanceInfo> {
  return (await readGovernance("get_governance_info")) as GovernanceInfo;
}

export async function getRegistryInfo(): Promise<RegistryInfo> {
  return (await readRegistry("get_registry_info")) as RegistryInfo;
}

/* ---------- Case discovery views (bounded reads) ---------- */

export const CATEGORY_PAGE_SIZE = 12;

export async function getDisputesByCategory(
  category: string,
  offset: number,
  limit: number,
): Promise<string[]> {
  const ids = await readCore("get_disputes_by_category", [category, offset, limit]);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

export async function getCategoryDisputeCount(category: string): Promise<number> {
  const count = await readCore("get_category_dispute_count", [category]);
  return typeof count === "number" ? count : Number(count ?? 0);
}

export async function disputeExists(disputeId: string): Promise<boolean> {
  return (await readCore("dispute_exists", [disputeId])) === true;
}

/* ---------- Case detail views ---------- */

export async function getDispute(disputeId: string): Promise<DisputeRaw> {
  return (await readCore("get_dispute", [disputeId])) as DisputeRaw;
}

export async function getVerdict(disputeId: string): Promise<VerdictRaw> {
  return (await readCore("get_verdict", [disputeId])) as VerdictRaw;
}

export async function getVerdictHistory(disputeId: string): Promise<VerdictRaw[]> {
  const history = await readCore("get_verdict_history", [disputeId]);
  return Array.isArray(history) ? (history as VerdictRaw[]) : [];
}

export async function getAppealHistory(disputeId: string): Promise<AppealEntryRaw[]> {
  const history = await readCore("get_appeal_history", [disputeId]);
  return Array.isArray(history) ? (history as AppealEntryRaw[]) : [];
}

export async function getAttestationByDispute(disputeId: string): Promise<AttestationRaw> {
  return (await readCore("get_attestation_by_dispute", [disputeId])) as AttestationRaw;
}

/* ---------- Filing / participation dependency views ---------- */

export interface ProtocolHealth {
  total_currently_failed_mirrors: number;
  governance_configured: boolean;
  contract_custodied_balance: number | string;
  treasury_address: string;
  dispute_filing_fee: number | string;
  appeal_bond_amount: number | string;
  settlements_pending_claim: number;
  paused: boolean | null;
  pending_governance_actions: number | null;
}

/**
 * Extends get_protocol_info with treasury/fee configuration. Fee fields can
 * reach 10^24 wei and arrive as strings (safe JSON conversion) - always
 * coerce through BigInt, never Number.
 */
export async function getProtocolHealth(): Promise<ProtocolHealth> {
  return (await readCore("get_protocol_health")) as ProtocolHealth;
}

/** Contract-recommended way to retrieve the dispute_id right after filing. */
export async function getLastDisputeId(claimantAddress: string): Promise<string> {
  const id = await readCore("get_last_dispute_id", [claimantAddress]);
  return typeof id === "string" ? id : "";
}

/** Governance whitelist check for external precedent URLs (prefix match). */
export async function isExternalSourceActive(url: string): Promise<boolean> {
  return (await readGovernance("is_external_source_active", [url])) === true;
}

/* ---------- Finality / verification views (Registry = authority) ---------- */

export type FinalityStatusRaw = {
  status: "INDEXED" | "FINAL_PENDING_MIRROR" | "NOT_FINAL";
  attestation_id: string;
};

/**
 * The tri-state verification primitive. Core finality and Registry
 * synchronization are separate concerns and must never be conflated:
 * FINAL_PENDING_MIRROR means the determination IS final - only the public
 * verification index is still synchronizing.
 */
export async function getFinalityStatus(disputeId: string): Promise<FinalityStatusRaw> {
  return (await readRegistry("get_finality_status", [disputeId])) as FinalityStatusRaw;
}

export interface RegistryIndexEntryRaw {
  attestation_id: string;
  dispute_id: string;
  external_ref: string;
  registered_at: number;
  is_revoked: boolean;
  revoke_reason: string;
}

export async function getRegistryIndexEntry(attestationId: string): Promise<RegistryIndexEntryRaw> {
  return (await readRegistry("get_index_entry", [attestationId])) as RegistryIndexEntryRaw;
}

export async function isMirrorFailed(disputeId: string): Promise<boolean> {
  return (await readCore("is_mirror_failed", [disputeId])) === true;
}

/**
 * Full, revocation-aware attestation data straight from the Registry -
 * the authoritative validity source for public verification. Raises
 * ERR:NOT_INDEXED when unknown.
 */
export async function getRegistryAttestation(
  attestationId: string,
): Promise<import("../metatrial/types").RegistryAttestationRaw> {
  return (await readRegistry("get_attestation", [attestationId])) as import(
    "../metatrial/types"
  ).RegistryAttestationRaw;
}

/** Registry attestation by dispute id. Raises ERR:DISPUTE_NOT_INDEXED. */
export async function getRegistryAttestationByDispute(
  disputeId: string,
): Promise<import("../metatrial/types").RegistryAttestationRaw> {
  return (await readRegistry("get_attestation_by_dispute", [disputeId])) as import(
    "../metatrial/types"
  ).RegistryAttestationRaw;
}

/** Registry attestation by platform external reference. */
export async function getAttestationByExternalRef(
  externalRef: string,
): Promise<import("../metatrial/types").RegistryAttestationRaw> {
  return (await readRegistry("get_attestation_by_external_ref", [externalRef])) as import(
    "../metatrial/types"
  ).RegistryAttestationRaw;
}

/* ---------- Settlement views ---------- */

export async function getDisputeSettlements(disputeId: string): Promise<string[]> {
  const ids = await readCore("get_dispute_settlements", [disputeId]);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

export async function getSettlement(
  settlementId: string,
): Promise<import("../metatrial/types").SettlementRaw> {
  return (await readCore("get_settlement", [settlementId])) as import(
    "../metatrial/types"
  ).SettlementRaw;
}

/**
 * Precise per-role pagination: call claimant and respondent separately
 * (role='any' applies offset to each index independently and merges -
 * documented in the contract - so it is not one continuous cursor).
 */
export async function getDisputesByAddress(
  addressHex: string,
  role: "claimant" | "respondent" | "any",
  offset: number,
  limit: number,
): Promise<string[]> {
  const ids = await readCore("get_disputes_by_address", [addressHex, role, offset, limit]);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/* ---------- Governance views ---------- */

export async function isGovernanceAdmin(addressHex: string): Promise<boolean> {
  return (await readGovernance("is_admin", [addressHex])) === true;
}

export interface GovernanceProposalRaw {
  proposal_id: string;
  action_type: string;
  target_hex: string;
  proposer_hex: string;
  created_at: number;
  expires_at: number;
  threshold_reached_at: number;
  ready_at: number;
  status: string;
  valid_approvals_now: number;
  current_threshold: number;
  param_participation_window: number;
  param_appeal_window: number;
  param_max_appeal_rounds: number;
  param_confidence_tolerance: number;
  param_max_disputes_per_respondent_window: number;
  param_max_disputes_per_claimant_window: number;
  param_dispute_filing_fee: number | string;
  param_appeal_bond_amount: number | string;
  param_treasury_address: string;
  param_external_source_active: boolean;
}

export async function getGovernanceProposal(
  proposalId: string,
): Promise<GovernanceProposalRaw> {
  return (await readGovernance("get_proposal", [proposalId])) as GovernanceProposalRaw;
}

export async function getGovernanceProposalIds(
  offset: number,
  limit: number,
): Promise<string[]> {
  const ids = await readGovernance("get_proposals", [offset, limit]);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/** Core-side flag: has an executed proposal's values been pulled into Core? */
export async function isGovernanceActionApplied(proposalId: string): Promise<boolean> {
  return (await readCore("is_governance_action_applied", [proposalId])) === true;
}

export interface GovernanceParamsRaw {
  active: import("../metatrial/types").ProtocolParamsLike;
  pending: import("../metatrial/types").ProtocolParamsLike;
  pending_activation_time: number;
}

/** Core's active + timelocked-pending protocol parameters. */
export async function getGovernanceParams(): Promise<GovernanceParamsRaw> {
  return (await readCore("get_governance_params")) as GovernanceParamsRaw;
}

/** Quick status read for pre-flight validation (e.g. precedent checks). */
export async function getDisputeStatus(disputeId: string): Promise<string> {
  const status = await readCore("get_dispute_status", [disputeId]);
  return typeof status === "string" ? status : String(status ?? "");
}
