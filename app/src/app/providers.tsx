"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useState } from "react";
import { WalletProvider } from "@/lib/wallet/wallet-context";

/**
 * React Query retry default, aligned with the read adapter's own
 * failover: deterministic contract errors (ERR:*, not-found) are never
 * retried; transport-level blips get one query-level retry on top of the
 * adapter's bounded per-attempt retries.
 */
function queryRetry(failureCount: number, error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "ContractReadError"
  ) {
    return false;
  }
  return failureCount < 1;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: queryRetry,
            // Recover silently when a component remounts after the RPC
            // hiccup that failed its first load (stale data is refetched
            // on mount instead of being re-shown).
            refetchOnMount: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <WalletProvider>{children}</WalletProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
