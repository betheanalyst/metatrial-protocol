import { useQuery, useQueries, type UseQueryResult } from "@tanstack/react-query";
import {
  CATEGORY_PAGE_SIZE,
  getAppealHistory,
  getAttestationByDispute,
  getCategoryDisputeCount,
  getDispute,
  getDisputesByCategory,
  getProtocolInfo,
  getVerdictHistory,
} from "@/lib/genlayer/reads";
import {
  toAppealEntry,
  toAttestation,
  toCaseDetail,
  toDetermination,
} from "./mappers";
import type {
  AppealEntry,
  Attestation,
  CaseDetail,
  Determination,
} from "./types";

/**
 * TanStack React Query hooks for MetaTrial contract state (foundation
 * specification: contract state flows through React Query; bounded reads,
 * no continuous polling).
 */

export const queryKeys = {
  protocolInfo: ["metatrial", "protocol-info"] as const,
  categoryIds: (category: string, page: number) =>
    ["metatrial", "category", category, "page", page] as const,
  categoryCount: (category: string) =>
    ["metatrial", "category-count", category] as const,
  dispute: (disputeId: string) => ["metatrial", "dispute", disputeId] as const,
  verdictHistory: (disputeId: string) =>
    ["metatrial", "verdict-history", disputeId] as const,
  appealHistory: (disputeId: string) =>
    ["metatrial", "appeal-history", disputeId] as const,
  attestation: (disputeId: string) =>
    ["metatrial", "attestation", disputeId] as const,
};

/**
 * Shared React Query retry policy (also exported for the explore view's
 * inline queries): permanent contract errors (not-found etc.) are never
 * retried; transport blips get one query-level retry on top of the read
 * adapter's bounded per-attempt failover.
 */
export function retryPolicy(failureCount: number, error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "ContractReadError"
  ) {
    return false;
  }
  return failureCount < 1;
}

export function useProtocolInfo() {
  return useQuery({
    queryKey: queryKeys.protocolInfo,
    queryFn: getProtocolInfo,
    staleTime: 5 * 60_000,
    retry: retryPolicy,
  });
}

export function useCategoryCaseIds(category: string, page: number) {
  return useQuery({
    queryKey: queryKeys.categoryIds(category, page),
    queryFn: () => getDisputesByCategory(category, page * CATEGORY_PAGE_SIZE, CATEGORY_PAGE_SIZE),
    staleTime: 30_000,
    retry: retryPolicy,
  });
}

export function useCategoryCaseCount(category: string) {
  return useQuery({
    queryKey: queryKeys.categoryCount(category),
    queryFn: () => getCategoryDisputeCount(category),
    staleTime: 30_000,
    retry: retryPolicy,
  });
}

export function useDispute(disputeId: string) {
  return useQuery({
    queryKey: queryKeys.dispute(disputeId),
    queryFn: async () => toCaseDetail(await getDispute(disputeId)),
    staleTime: 15_000,
    retry: retryPolicy,
  });
}

export function useVerdictHistory(disputeId: string, enabled: boolean): UseQueryResult<Determination[], unknown> {
  return useQuery({
    queryKey: queryKeys.verdictHistory(disputeId),
    queryFn: async () => {
      const history = await getVerdictHistory(disputeId);
      return history.map((entry, index) => toDetermination(entry, index === history.length - 1));
    },
    enabled,
    staleTime: 15_000,
    retry: retryPolicy,
  });
}

export function useAppealHistory(disputeId: string, enabled: boolean): UseQueryResult<AppealEntry[], unknown> {
  return useQuery({
    queryKey: queryKeys.appealHistory(disputeId),
    queryFn: async () => (await getAppealHistory(disputeId)).map(toAppealEntry),
    enabled,
    staleTime: 15_000,
    retry: retryPolicy,
  });
}

export function useAttestation(disputeId: string, enabled: boolean): UseQueryResult<Attestation, unknown> {
  return useQuery({
    queryKey: queryKeys.attestation(disputeId),
    queryFn: async () => toAttestation(await getAttestationByDispute(disputeId)),
    enabled,
    staleTime: 5 * 60_000,
    retry: retryPolicy,
  });
}

/** Fetch detail models for a page of dispute ids (bounded, parallel). */
export function useCaseDetails(disputeIds: string[]): UseQueryResult<CaseDetail, unknown>[] {
  return useQueries({
    queries: disputeIds.map((disputeId) => ({
      queryKey: queryKeys.dispute(disputeId),
      queryFn: async () => toCaseDetail(await getDispute(disputeId)),
      staleTime: 15_000,
      retry: retryPolicy,
    })),
  });
}
