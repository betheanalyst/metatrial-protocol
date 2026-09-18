"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getCategoryDisputeCount,
  getDispute,
  getDisputesByCategory,
  getProtocolInfo,
  getVerdict,
} from "@/lib/genlayer/reads";
import { retryPolicy } from "@/lib/metatrial/queries";
import { toCaseDetail } from "@/lib/metatrial/mappers";
import { categoryLabel, rulingLabel } from "@/lib/metatrial/labels";
import type { CaseDetail } from "@/lib/metatrial/types";
import { formatDate } from "@/lib/utils/format";
import { ButtonLink } from "@/components/ui/button";
import { CaseIdChip, StatusPill } from "@/components/cases/case-parts";

/**
 * Recent-tail computation: the contracts index cases per category in
 * submission order, with no global recency index. "Recent" is therefore
 * derived honestly from the tail of each category's index and merged
 * client-side - bounded reads, no fabricated ordering.
 */
export const RECENT_PER_CATEGORY = 3;
export const RECENT_MERGED_LIMIT = 6;

export function recentTailOffset(count: number): number {
  return Math.max(count - RECENT_PER_CATEGORY, 0);
}

interface RecentEntry {
  detail: CaseDetail;
  ruling: string | null;
}

function RecentRow({ entry }: { entry: RecentEntry }) {
  const { detail, ruling } = entry;
  return (
    <li className="py-5">
      <Link href={`/cases/${detail.id}?from=explore`} className="group block">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CaseIdChip disputeId={detail.id} caseNumber={detail.caseNumber} />
          <span className="rounded-full bg-attest-tint px-2.5 py-0.5 text-xs font-medium text-attest-deep">
            {detail.categoryLabel}
          </span>
          <StatusPill status={detail.status} />
          {ruling !== null ? (
            <span className="text-xs font-medium text-ink">{ruling}</span>
          ) : null}
        </div>
        <h3 className="mt-2 text-lg font-medium tracking-tight text-ink group-hover:text-attest-deep">
          {detail.title}
        </h3>
        <p className="mt-1 text-xs text-muted">Filed {formatDate(detail.createdAt)}</p>
      </Link>
    </li>
  );
}

export function ExploreView() {
  const router = useRouter();
  const [lookup, setLookup] = useState("");

  const protocolInfoQuery = useQuery({
    queryKey: ["metatrial", "protocol-info"],
    queryFn: getProtocolInfo,
    staleTime: 5 * 60_000,
    retry: retryPolicy,
  });
  const categories = protocolInfoQuery.data?.valid_categories ?? [];

  const countsQuery = useQuery({
    queryKey: ["metatrial", "explore", "category-counts"],
    queryFn: async () => {
      const entries = await Promise.all(
        categories.map(async (category) => [
          category,
          await getCategoryDisputeCount(category),
        ] as const),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    enabled: categories.length > 0,
    staleTime: 30_000,
    retry: retryPolicy,
  });

  const counts = countsQuery.data ?? {};
  const nonEmpty = Object.entries(counts).filter(([, count]) => count > 0);

  const tailsQuery = useQuery({
    queryKey: ["metatrial", "explore", "recent-tails"],
    queryFn: async () => {
      const entries = await Promise.all(
        nonEmpty.map(async ([category, count]) => [
          category,
          await getDisputesByCategory(category, recentTailOffset(count), RECENT_PER_CATEGORY),
        ] as const),
      );
      return entries.flatMap(([category, ids]) =>
        ids.map((disputeId) => ({ category, disputeId })),
      );
    },
    enabled: nonEmpty.length > 0,
    staleTime: 30_000,
    retry: retryPolicy,
  });

  const tailIds = tailsQuery.data ?? [];
  const detailQueries = useQueries({
    queries: tailIds.map(({ disputeId }) => ({
      queryKey: ["metatrial", "dispute", disputeId],
      queryFn: async () => toCaseDetail(await getDispute(disputeId)),
      staleTime: 15_000,
      retry: retryPolicy,
    })),
  });

  const recent: RecentEntry[] = detailQueries
    .map((entry) => entry.data)
    .filter((entry) => entry !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_MERGED_LIMIT)
    .map((detail) => ({ detail, ruling: null }));

  const verdictQueries = useQueries({
    queries: recent
      .filter((entry) => entry.detail.hasVerdict === true)
      .map((entry) => ({
        queryKey: ["metatrial", "verdict", entry.detail.id],
        queryFn: async () => ({
          disputeId: entry.detail.id,
          ruling: rulingLabel((await getVerdict(entry.detail.id)).ruling),
        }),
        staleTime: 60_000,
        retry: retryPolicy,
      })),
  });

  // Deduplicate by case id - a stale tail window can surface the same case
  // twice while counts and tails refresh, and duplicate keys crash the list.
  const withRulings: RecentEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of recent) {
    const key = entry.detail.id;
    if (key === undefined || seenIds.has(key)) {
      continue;
    }
    seenIds.add(key);
    const verdict = verdictQueries.find(
      (query) => query.data?.disputeId === key,
    );
    withRulings.push({ ...entry, ruling: verdict?.data?.ruling ?? null });
  }

  function submitLookup() {
    const trimmed = lookup.trim();
    if (trimmed !== "") {
      router.push(`/cases/${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <div className="space-y-14">
      <section aria-label="Categories">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Categories
        </h2>
        {countsQuery.isLoading || protocolInfoQuery.isLoading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-line" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => {
              const count = counts[category] ?? 0;
              return (
                <Link
                  key={category}
                  href={`/cases?category=${category}`}
                  className="group rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-attest/50"
                >
                  <p className="text-sm font-semibold tracking-tight text-ink group-hover:text-attest-deep">
                    {categoryLabel(category)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {count === 1 ? "1 case" : `${count} cases`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Recent cases">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Recently filed
        </h2>
        {tailsQuery.isLoading || (tailsQuery.data !== undefined && detailQueries.some((entry) => entry.isLoading)) ? (
          <ul className="mt-2 divide-y divide-line">
            {Array.from({ length: 3 }).map((_, index) => (
              <li key={index} className="animate-pulse space-y-2 py-5">
                <div className="h-3 w-40 rounded bg-line" />
                <div className="h-4 w-2/3 rounded bg-line" />
              </li>
            ))}
          </ul>
        ) : tailsQuery.isError ? (
          <div className="mt-4 rounded-xl border border-line bg-white px-5 py-4 text-sm text-muted">
            The record index could not be read right now - the network may be
            briefly unavailable.{" "}
            <button
              type="button"
              onClick={() => {
                void tailsQuery.refetch();
              }}
              className="font-medium text-attest-deep underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : withRulings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No cases filed yet - the first cases will appear here as they enter
            the record.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {withRulings.map((entry) => (
              <RecentRow key={entry.detail.id} entry={entry} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Drawn from the newest entries across all categories - cases with
          determinations show their ruling.
        </p>
      </section>

      <section aria-label="Find a specific record" className="max-w-xl">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Find a specific record
        </h2>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitLookup();
          }}
        >
          <label htmlFor="explore-lookup" className="sr-only">
            Open a case by its Case ID
          </label>
          <input
            id="explore-lookup"
            value={lookup}
            onChange={(event) => {
              setLookup(event.target.value);
            }}
            placeholder="Open a case - e.g. MT-00000012-1a2b3c4d"
            spellCheck={false}
            className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-attest focus:outline-none"
          />
          <ButtonLink href="/verify" variant="secondary" className="shrink-0 px-4 py-2.5">
            Verify an attestation
          </ButtonLink>
          <button
            type="submit"
            disabled={lookup.trim() === ""}
            className="shrink-0 rounded-full bg-attest px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-attest-deep disabled:opacity-60"
          >
            Open
          </button>
        </form>
      </section>

      <p className="max-w-article text-xs leading-relaxed text-muted">
        For integrating platforms: every determination carries a
        machine-readable ruling code, and platform case references travel with
        the record as external references. Precedent exploration - surfacing
        similar disputes, findings, and remedies - arrives in a later phase.
      </p>
    </div>
  );
}
