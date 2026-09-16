/**
 * Injected EIP-1193 wallet utilities for GenLayer Studio Devnet.
 *
 * MetaTrial deliberately uses the browser-injected provider directly
 * (window.ethereum - Rabby, MetaMask, and compatible wallets) rather than a
 * wallet framework, per the adopted foundation specification.
 *
 * Every function accepts its dependencies (window / provider) as optional
 * parameters so the logic can be exercised in non-browser environments and
 * unit tests, while defaulting to the real browser objects at runtime.
 */

import { NETWORK } from "../config/protocol";

export interface Eip1193Provider {
  request: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
}

export interface Eip1193Window {
  ethereum?: Eip1193Provider;
}

/** EIP-3085 chain parameters for adding Studio Devnet to a wallet. */
export const STUDIO_DEVNET_CHAIN_PARAMS = {
  chainId: NETWORK.chainIdHex,
  chainName: NETWORK.name,
  nativeCurrency: NETWORK.nativeCurrency,
  rpcUrls: [NETWORK.rpcUrl],
  blockExplorerUrls: [NETWORK.blockExplorerUrl],
} as const;

/**
 * Discover an injected EIP-1193 provider.
 * Preference order: Rabby, then MetaMask, then the first available.
 * Returns null when no wallet is installed (or outside a browser).
 */
export function getInjectedProvider(
  win?: Eip1193Window,
): Eip1193Provider | null {
  const browserWindow: Eip1193Window | undefined =
    win ?? (typeof window === "undefined" ? undefined : (window as unknown as Eip1193Window));
  const ethereum = browserWindow?.ethereum;
  if (ethereum === undefined || ethereum === null) {
    return null;
  }
  const candidates = ethereum.providers;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const rabby = candidates.find((provider) => provider.isRabby === true);
    if (rabby !== undefined) {
      return rabby;
    }
    const metaMask = candidates.find(
      (provider) => provider.isMetaMask === true && provider.isRabby !== true,
    );
    if (metaMask !== undefined) {
      return metaMask;
    }
    return candidates[0];
  }
  return ethereum;
}

/** Read the wallet's currently selected chain ID (eth_chainId). */
export async function detectChainId(
  provider: Eip1193Provider,
): Promise<number> {
  const result = await provider.request({ method: "eth_chainId", params: [] });
  if (typeof result !== "string" || result.startsWith("0x") === false) {
    throw new Error(`Unexpected eth_chainId response: ${String(result)}`);
  }
  return Number.parseInt(result, 16);
}

export function isStudioDevnetChainId(chainId: number): boolean {
  return chainId === NETWORK.chainId;
}

/** Request account access (eth_requestAccounts) - shows the wallet prompt. */
export async function requestAccounts(
  provider: Eip1193Provider,
): Promise<string[]> {
  const result = await provider.request({
    method: "eth_requestAccounts",
    params: [],
  });
  if (Array.isArray(result) === false) {
    throw new Error("Unexpected eth_requestAccounts response");
  }
  return result.filter((entry): entry is string => typeof entry === "string");
}

/** Read already-authorized accounts (eth_accounts) - never prompts. */
export async function getAccounts(
  provider: Eip1193Provider,
): Promise<string[]> {
  const result = await provider.request({ method: "eth_accounts", params: [] });
  if (Array.isArray(result) === false) {
    throw new Error("Unexpected eth_accounts response");
  }
  return result.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Ensure the wallet is on Studio Devnet before signing anything: a no-op
 * when it already is; otherwise switch (or add-and-switch). Every write
 * path must call this first - a transaction submitted from the wrong chain
 * is rejected by the wallet with an opaque error.
 */
export async function ensureStudioDevnet(provider: Eip1193Provider): Promise<void> {
  const chainId = await detectChainId(provider);
  if (isStudioDevnetChainId(chainId) === false) {
    await switchOrAddStudioDevnet(provider);
  }
}

/**
 * Switch the wallet to Studio Devnet, adding the chain when the wallet does
 * not know it yet (EIP-3324 switch with EIP-3085 add fallback).
 */
export async function switchOrAddStudioDevnet(
  provider: Eip1193Provider,
): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_DEVNET_CHAIN_PARAMS.chainId }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902 && code !== -32603) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [STUDIO_DEVNET_CHAIN_PARAMS],
    });
  }
}
