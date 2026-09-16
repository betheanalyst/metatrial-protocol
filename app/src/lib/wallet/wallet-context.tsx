"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWalletState } from "./use-wallet";
import type { WalletState } from "./use-wallet";

type WalletContextValue = WalletState & {
  onStudioDevnet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Single shared wallet state for the whole app - the header, write flows,
 * and role-aware case views all read from one source of truth.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const state = useWalletState();
  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (context === null) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
