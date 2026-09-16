"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectChainId,
  getAccounts,
  getInjectedProvider,
  isStudioDevnetChainId,
  requestAccounts,
  switchOrAddStudioDevnet,
  type Eip1193Provider,
} from "./injected";

export interface WalletState {
  hasProvider: boolean;
  status: "idle" | "connecting" | "connected";
  address: string | null;
  chainId: number | null;
  error: string | null;
}

const initialState: WalletState = {
  hasProvider: false,
  status: "idle",
  address: null,
  chainId: null,
  error: null,
};

/**
 * Minimal injected-wallet connection state. Use \`useWallet()\` from wallet-context for app-wide shared state.
 *
 * Deliberately quiet: no wallet framework, no account persistence beyond
 * what the wallet itself remembers, no private material ever touched.
 * "Disconnect" clears local UI state only - the wallet stays connected.
 */
export function useWalletState() {
  const [state, setState] = useState<WalletState>(initialState);
  const providerRef = useRef<Eip1193Provider | null>(null);

  const refreshChain = useCallback(async (provider: Eip1193Provider) => {
    try {
      const chainId = await detectChainId(provider);
      setState((prev) => ({ ...prev, chainId }));
    } catch {
      setState((prev) => ({ ...prev, chainId: null }));
    }
  }, []);

  // Detect an injected provider and silently restore already-authorized
  // accounts (eth_accounts never prompts).
  useEffect(() => {
    const provider = getInjectedProvider();
    providerRef.current = provider;
    setState((prev) => ({ ...prev, hasProvider: provider !== null }));
    if (provider === null) {
      return;
    }
    let cancelled = false;
    getAccounts(provider)
      .then((accounts) => {
        if (cancelled || accounts.length === 0) {
          return;
        }
        setState((prev) => ({
          ...prev,
          status: "connected",
          address: accounts[0] ?? null,
        }));
      })
      .catch(() => undefined);
    void refreshChain(provider);
    return () => {
      cancelled = true;
    };
  }, [refreshChain]);

  // Follow wallet-side account and network changes.
  useEffect(() => {
    const provider = providerRef.current;
    if (provider === null || provider.on === undefined) {
      return;
    }
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? args[0] : [];
      const first = typeof accounts[0] === "string" ? accounts[0] : null;
      setState((prev) => ({
        ...prev,
        status: first === null ? "idle" : "connected",
        address: first,
      }));
    };
    const onChainChanged = (...args: unknown[]) => {
      const raw = args[0];
      if (typeof raw === "string" && raw.startsWith("0x")) {
        setState((prev) => ({
          ...prev,
          chainId: Number.parseInt(raw, 16),
        }));
      }
    };
    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = providerRef.current ?? getInjectedProvider();
    if (provider === null) {
      setState((prev) => ({
        ...prev,
        hasProvider: false,
        error: "No injected wallet detected in this browser.",
      }));
      return;
    }
    providerRef.current = provider;
    setState((prev) => ({
      ...prev,
      hasProvider: true,
      status: "connecting",
      error: null,
    }));
    try {
      const accounts = await requestAccounts(provider);
      const address = accounts[0] ?? null;
      setState((prev) => ({
        ...prev,
        status: address === null ? "idle" : "connected",
        address,
      }));
      await refreshChain(provider);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "idle",
        error:
          error instanceof Error
            ? error.message
            : "Wallet connection was not completed.",
      }));
    }
  }, [refreshChain]);

  const disconnect = useCallback(() => {
    setState((prev) => ({ ...prev, status: "idle", address: null }));
  }, []);

  const switchNetwork = useCallback(async () => {
    const provider = providerRef.current;
    if (provider === null) {
      return;
    }
    try {
      await switchOrAddStudioDevnet(provider);
      await refreshChain(provider);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Network switch was not completed.",
      }));
    }
  }, [refreshChain]);

  const onStudioDevnet =
    state.chainId === null ? false : isStudioDevnetChainId(state.chainId);

  return { ...state, onStudioDevnet, connect, disconnect, switchNetwork };
}
