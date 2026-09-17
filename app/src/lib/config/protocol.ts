import { isAddress } from "viem";
import protocolJson from "./protocol.json";

export interface NativeCurrencyConfig {
  name: string;
  symbol: string;
  decimals: number;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  chainIdHex: string;
  rpcUrl: string;
  /** Optional secondary RPC for the same deployment (failover/manual use). */
  alternativeRpcUrl?: string;
  nativeCurrency: NativeCurrencyConfig;
  blockExplorerUrl: string;
}

/**
 * Consensus-level fee profile measured on this deployment: a successful AI
 * write (full arbitration round) was executed with exactly this per-round
 * execution budget. The deposit is taken up-front and the unused budget is
 * refunded after execution. Consensus-level network configuration - not a
 * governance parameter; read at fee-estimation time, never hard-coded in
 * write logic.
 */
export interface FeeProfileConfig {
  executionBudgetPerRound: string;
  source: string;
}

export interface ContractsConfig {
  core: string;
  governance: string;
  attestationRegistry: string;
}

export interface ProtocolConfig {
  network: NetworkConfig;
  contracts: ContractsConfig;
  fees: FeeProfileConfig;
}

/**
 * Single source of truth for MetaTrial network and contract configuration.
 *
 * Kept as structured data so both the TypeScript application and the Node
 * compatibility-gate script can consume identical values. Every GenLayer
 * integration must read network and contract settings from here - never
 * from scattered hard-coded values.
 */
export const protocolConfig: ProtocolConfig = protocolJson;

export const NETWORK = protocolConfig.network;
export const CONTRACTS = protocolConfig.contracts;
export const FEES = protocolConfig.fees;

function assert(condition: unknown, message: string): asserts condition {
  if (condition === false || condition === undefined || condition === null) {
    throw new Error(`MetaTrial protocol configuration invalid: ${message}`);
  }
}

assert(
  NETWORK.chainId === 61997,
  `expected Studio Devnet chainId 61997, got ${NETWORK.chainId}`,
);
assert(
  Number.parseInt(NETWORK.chainIdHex, 16) === NETWORK.chainId,
  `chainIdHex '${NETWORK.chainIdHex}' does not match chainId ${NETWORK.chainId}`,
);
assert(
  NETWORK.rpcUrl.startsWith("https://"),
  `rpcUrl must be https, got '${NETWORK.rpcUrl}'`,
);

for (const [label, address] of Object.entries(CONTRACTS)) {
  assert(
    isAddress(address),
    `${label} address '${address}' is not a valid EVM address`,
  );
}
