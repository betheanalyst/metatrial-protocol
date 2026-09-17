import { createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import type { CalldataEncodable } from "genlayer-js/types";
import { CONTRACTS, FEES } from "../config/protocol";
import { describeWriteFailure } from "../metatrial/write-errors";
import type { Eip1193Provider } from "../wallet/injected";
import { ensureStudioDevnet } from "../wallet/injected";
import { trackTransaction, updateTransaction } from "../wallet/tx-tracker";

/**
 * Write adapter - the only place that submits transactions to MetaTrial.
 *
 * Every write follows the product lifecycle: the caller shows a review
 * step, the wallet confirms, the envelope is submitted, consensus is
 * awaited through the SDK, and only the confirmed protocol outcome is
 * reported (a transaction hash alone is never treated as success).
 * On Studio Devnet writeContract() resolves with the envelope hash once
 * the wallet's transaction is committed - consensus is awaited separately.
 */

export function createSigningClient(
  walletAddress: string,
  provider: Eip1193Provider | null,
) {
  return createClient({
    chain: studioDevnet,
    account: walletAddress as `0x${string}`,
    ...(provider !== null ? { provider: provider as never } : {}),
  });
}

/**
 * Fees and amounts can reach 10^24 wei and arrive as strings from safe JSON
 * conversion. Coerce through BigInt only - never Number.
 */
export function toBigIntSafe(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }
  return BigInt(String(value));
}

export type WriteStatus = "success" | "failed" | "uncertain";

export interface WriteOutcome {
  status: WriteStatus;
  /** Human-readable message (already mapped from contract ERR codes). */
  primary: string;
  /** Raw contract code / technical detail for progressive disclosure. */
  raw: string | null;
  /** The envelope transaction hash, when one was created. */
  hash: string | null;
}

const CONSENSUS_POLL_INTERVAL_MS = 3_000;
/** Simple writes resolve quickly; arbitration writes can take minutes. */
const RETRIES_SIMPLE = 100;
const RETRIES_ARBITRATION = 240;

/**
 * Policy-based fee estimate tuned to the deployment's measured fee profile
 * (protocol.json -> fees): the per-round GenVM execution budget of a
 * successful AI write on this deployment. The SDK still reads the live fee
 * policy for price caps; the full deposit is taken up-front and the unused
 * budget is refunded after execution.
 */
async function estimatePolicyBasedFees(
  client: ReturnType<typeof createSigningClient>,
) {
  return client.estimateTransactionFees({
    executionBudgetPerRound: BigInt(FEES.executionBudgetPerRound),
  });
}

/**
 * Arbitration-grade estimate: the measured profile plus raised leader/
 * validator timeunit allocations and an extended rotation budget, so the
 * validators have enough compute time for MetaTrial's heavier arbitration
 * (evidence and precedent fetches, multi-call equivalence consensus).
 */
async function estimateArbitrationFees(
  client: ReturnType<typeof createSigningClient>,
) {
  return client.estimateTransactionFees({
    executionBudgetPerRound: BigInt(FEES.executionBudgetPerRound),
    leaderTimeunitsAllocation: BigInt(FEES.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(FEES.validatorTimeunitsAllocation),
    rotations: [BigInt(FEES.consensusMaxRotations)],
  });
}

async function performWrite(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  functionName: string;
  args: CalldataEncodable[];
  value?: bigint;
  label: string;
  arbitration?: boolean;
  /** Which contract to target; defaults to MetaTrial Core. */
  target?: string;
}): Promise<WriteOutcome> {
  const client = createSigningClient(opts.walletAddress, opts.provider);

  // A transaction submitted while the wallet is on a different chain is
  // rejected by the wallet with an opaque error - ensure the network first
  // (no-op when already correct; prompts switch/add when not).
  if (opts.provider !== null) {
    try {
      await ensureStudioDevnet(opts.provider);
    } catch (error) {
      const described = describeWriteFailure(error);
      const rejected =
        error instanceof Error &&
        (error.message.includes("rejected") ||
          error.message.toLowerCase().includes("user rejected"));
      return {
        status: "failed",
        primary: rejected
          ? "The network switch was not approved - nothing was submitted. You can try again."
          : "This wallet could not be switched to GenLayer Studio Devnet (chain 61997). Approve the network in your wallet and submit again.",
        raw: described.raw,
        hash: null,
      };
    }
  }

  // Fee handling (mirrors the official @genlayer/transaction-kit submit
  // pattern): every consensus transaction requires a nonzero fee deposit
  // (a zero-fee envelope is rejected: FeeValueMustBeNonZero); writes whose
  // execution EMITS messages (AI arbitration calls, async cross-contract
  // notifications) must also DECLARE a message-fee budget - read live from
  // the network's sim_getFeeConfig floor - because an undeclared emission
  // is rejected by the GenVM (fee no_matching_allocation).
  const signerAccount = {
    address: opts.walletAddress as `0x${string}`,
    type: "json-rpc",
  } as never;
  const call = {
    account: signerAccount,
    address: (opts.target ?? CONTRACTS.core) as `0x${string}`,
    functionName: opts.functionName,
    args: opts.args,
    value: opts.value ?? 0n,
  };

  let hash: string;
  try {
    // Always policy-based: the simulated estimator cannot execute these
    // contracts (they validate the transaction timestamp, which simulated
    // gen_call does not carry), so simulating only burns three doomed RPC
    // retries before the same policy-based estimate.
    const recommended = await (opts.arbitration === true
      ? estimateArbitrationFees(client)
      : estimatePolicyBasedFees(client));
    hash = await client.writeContract({
      ...call,
      // Arbitration writes rotate through more leaders (heavier workload):
      // keep the consensus rotation budget consistent with the fee
      // distribution's rotations.
      ...(opts.arbitration === true
        ? { consensusMaxRotations: FEES.consensusMaxRotations }
        : {}),
      fees: {
        distribution: recommended.distribution,
        feeValue: recommended.feeValue,
      },
    });
  } catch (error) {
    // Wallet rejected, gas/envelope failure, or a pre-submission error.
    const described = describeWriteFailure(error);
    return { status: "failed", primary: described.primary, raw: described.raw, hash: null };
  }

  trackTransaction(hash, opts.label);

  try {
    const tx = await client.waitForTransactionReceipt({
      // TransactionHash is a structural { length: 66 } type in the SDK; the
      // runtime value is exactly the hash string writeContract returned.
      hash: hash as never,
      waitUntil: "decided",
      interval: CONSENSUS_POLL_INTERVAL_MS,
      retries: opts.arbitration === true ? RETRIES_ARBITRATION : RETRIES_SIMPLE,
      fullTransaction: true,
    });
    if (isSuccessful(tx) === true) {
      updateTransaction(hash, "success");
      return { status: "success", primary: "", raw: null, hash };
    }
    updateTransaction(hash, "failed");
    const described = describeWriteFailure(tx);
    const txStatus = String(
      (tx as { statusName?: unknown }).statusName ??
        (tx as { status?: unknown }).status ??
        "unknown",
    );
    return {
      status: "failed",
      primary: described.primary,
      raw: described.raw ?? `consensus status: ${txStatus}`,
      hash,
    };
  } catch (error) {
    // Polling gave up - consensus may still be running. Never claim failure.
    updateTransaction(hash, "uncertain");
    return {
      status: "uncertain",
      primary:
        "The transaction is still being processed by consensus. Its outcome will appear on the case shortly - you can also follow it in the explorer.",
      raw: error instanceof Error ? error.message.slice(0, 160) : null,
      hash,
    };
  }
}

export interface SubmitDisputeInput {
  respondentAddress: string;
  title: string;
  category: string;
  disputeContext: string;
  externalRef: string;
  claimantStatement: string;
  evidenceType: string;
  evidenceContent: string;
  evidenceHash: string;
  evidenceSummary: string;
  requestedSkipParticipation: boolean;
  requestedSkipAppeal: boolean;
  precedentDisputeIds: string[];
  externalPrecedentUrls: string[];
}

export async function submitDispute(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  input: SubmitDisputeInput;
  filingFeeWei: bigint;
}): Promise<WriteOutcome> {
  const input = opts.input;
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "submit_dispute",
    label: "File case",
    value: opts.filingFeeWei,
    args: [
      input.respondentAddress,
      input.title,
      input.category,
      input.disputeContext,
      input.externalRef,
      input.claimantStatement,
      input.evidenceType,
      input.evidenceContent,
      input.evidenceHash,
      input.evidenceSummary,
      input.requestedSkipParticipation,
      input.requestedSkipAppeal,
      input.precedentDisputeIds,
      input.externalPrecedentUrls,
    ],
  });
}

export async function respondToDispute(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  disputeId: string;
  statement: string;
  evidenceType: string;
  evidenceContent: string;
  evidenceHash: string;
  evidenceSummary: string;
  consentSkipParticipation: boolean;
  consentSkipAppeal: boolean;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "respond_to_dispute",
    label: "Respond to case",
    args: [
      opts.disputeId,
      opts.statement,
      opts.evidenceType,
      opts.evidenceContent,
      opts.evidenceHash,
      opts.evidenceSummary,
      opts.consentSkipParticipation,
      opts.consentSkipAppeal,
    ],
  });
}

export async function triggerArbitration(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  disputeId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "trigger_arbitration",
    label: "Start review",
    arbitration: true,
    args: [opts.disputeId],
  });
}

export async function fileAppeal(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  disputeId: string;
  groundType: string;
  explanation: string;
  specific: string;
  impact: string;
  precedentDisputeIds: string[];
  externalPrecedentUrls: string[];
  bondWei: bigint;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "file_appeal",
    label: "File appeal",
    arbitration: true,
    value: opts.bondWei,
    args: [
      opts.disputeId,
      opts.groundType,
      opts.explanation,
      opts.specific,
      opts.impact,
      opts.precedentDisputeIds,
      opts.externalPrecedentUrls,
    ],
  });
}

/** Permissionless: seals the record once the appeal window has passed. */
export async function finalizeDispute(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  disputeId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "finalize",
    label: "Finalize case",
    args: [opts.disputeId],
  });
}

/** Permissionless recovery for a failed or unconfirmed registry mirror. */
export async function retryMirror(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  disputeId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "retry_mirror",
    label: "Retry registry mirror",
    args: [opts.disputeId],
  });
}

/** Permissionless on-chain delivery of an authorized settlement. */
export async function claimSettlement(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  settlementId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "claim_settlement",
    label: "Claim settlement",
    args: [opts.settlementId],
  });
}

/* ---------- Governance writes ---------- */

/** Approve a pending proposal (admins only; a proposer cannot self-approve). */
export async function approveProposal(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  proposalId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "approve",
    label: "Approve proposal",
    args: [opts.proposalId],
  });
}

/**
 * Permissionless execution once a proposal's timelock has elapsed -
 * exactly-once, never a silent replay.
 */
export async function executeProposal(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  proposalId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "execute",
    label: "Execute proposal",
    args: [opts.proposalId],
  });
}

/**
 * Core pulls an executed CORE_PARAM_UPDATE / TREASURY_UPDATE authorization
 * ("governance authorizes, Core applies"). Permissionless.
 */
export async function applyGovernanceActionToCore(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  proposalId: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "apply_governance_action",
    label: "Apply authorized change to Core",
    args: [opts.proposalId],
  });
}

/** Explicitly activate a timelocked Core parameter change (permissionless). */
export async function applyPendingParameters(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    functionName: "apply_parameter_update",
    label: "Activate pending parameters",
    args: [],
  });
}

/* ---------- Governance proposal creation (admin-gated in the UI) ---------- */

export interface ProposeCoreParamsInput {
  participationWindow: number;
  appealWindow: number;
  maxAppealRounds: number;
  confidenceTolerance: number;
  maxDisputesPerRespondentWindow: number;
  maxDisputesPerClaimantWindow: number;
}

export async function proposeAddAdmin(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  targetAddress: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_add_admin",
    label: "Propose add admin",
    args: [opts.targetAddress],
  });
}

export async function proposeRemoveAdmin(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  targetAddress: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_remove_admin",
    label: "Propose remove admin",
    args: [opts.targetAddress],
  });
}

export async function proposeCoreParamUpdate(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  input: ProposeCoreParamsInput;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_core_param_update",
    label: "Propose parameter update",
    args: [
      opts.input.participationWindow,
      opts.input.appealWindow,
      opts.input.maxAppealRounds,
      opts.input.confidenceTolerance,
      opts.input.maxDisputesPerRespondentWindow,
      opts.input.maxDisputesPerClaimantWindow,
    ],
  });
}

export async function proposeTreasuryUpdate(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  filingFeeWei: bigint;
  bondWei: bigint;
  treasuryAddress: string;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_treasury_update",
    label: "Propose treasury update",
    args: [opts.filingFeeWei, opts.bondWei, opts.treasuryAddress],
  });
}

export async function proposeExternalSourceUpdate(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
  urlPrefix: string;
  active: boolean;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_external_source_update",
    label: "Propose external source update",
    args: [opts.urlPrefix, opts.active],
  });
}

export async function proposePause(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_pause",
    label: "Propose pause",
    args: [],
  });
}

export async function proposeUnpause(opts: {
  walletAddress: string;
  provider: Eip1193Provider | null;
}): Promise<WriteOutcome> {
  return performWrite({
    walletAddress: opts.walletAddress,
    provider: opts.provider,
    target: CONTRACTS.governance,
    functionName: "propose_unpause",
    label: "Propose unpause",
    args: [],
  });
}
