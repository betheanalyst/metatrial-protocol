"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ContractReadError } from "@/lib/genlayer/reads";
import { CATEGORY_PAGE_SIZE } from "@/lib/genlayer/reads";
import {
  useCaseDetails,
  useCategoryCaseCount,
  useCategoryCaseIds,
  useProtocolInfo,
} from "@/lib/metatrial/queries";
import { categoryLabel } from "@/lib/metatrial/labels";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { AddressChip, CaseIdChip, StatusPill } from "./case-parts";

type LookupState = { kind: "idle" } | { kind: "invalid" };

function CaseRowSkeleton() {
  return (
    <li className="py-5">
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-40 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-3 w-1/3 rounded bg-line" />
      </div>
    </li>
  );
}

export function CasesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const protocolInfo = useProtocolInfo();

  const categories = protocolInfo.data?.valid_categories ?? [];
  const requestedCategory = searchParams.get("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    requestedCategory !== null && requestedCategory !== "" ? requestedCategory : null,
  );
  const [page, setPage] = useState(0);
  const [lookupValue, setLookupValue] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>({ kind: "idle" });

  const category = selectedCategory ?? categories[0] ?? "";

  const idsQuery = useCategoryCaseIds(category, page);
  const countQuery = useCategoryCaseCount(category);
  const detailQueries = useCaseDetails(idsQuery.data ?? []);

  const total = countQuery.data ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));

  const lookupIsValid =
    lookupValue.trim() === "" || /^MT-\d{8}-[0-9a-fA-F]{8}$/.test(lookupValue.trim());

  function submitLookup() {
    const trimmed = lookupValue.trim();
    if (trimmed === "") {
      return;
    }
    if (lookupIsValid === false) {
      setLookupState({ kind: "invalid" });
      return;
    }
    router.push(`/cases/${trimmed}`);
  }

  return (
    <div className="space-y-10">
      {/* Category browsing - the discovery path the contracts support. */}
      <nav aria-label="Case categories" className="flex flex-wrap gap-2">
        {protocolInfo.isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className="h-8 w-24 animate-pulse rounded-full bg-line"
              />
            ))
          : categories.map((entry) => {
              const active = entry === category;
              return (
                <button
                  key={entry}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => {
                    setSelectedCategory(entry);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    active
                      ? "border-attest bg-attest text-paper"
                      : "border-line bg-white text-muted hover:border-ink/40 hover:text-ink",
                  )}
                >
                  {categoryLabel(entry)}
                </button>
              );
            })}
      </nav>

      {/* Lookup by Case ID - the other path the contracts support. */}
      <form
        className="flex max-w-xl flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submitLookup();
        }}
      >
        <label className="sr-only" htmlFor="case-lookup">
          Look up a case by its Case ID
        </label>
        <input
          id="case-lookup"
          value={lookupValue}
          onChange={(event) => {
            setLookupValue(event.target.value);
            setLookupState({ kind: "idle" });
          }}
          placeholder="Look up a case - e.g. MT-00000012-1a2b3c4d"
          spellCheck={false}
          className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-attest focus:outline-none"
        />
        <Button
          type="submit"
          variant="secondary"
          className="shrink-0 px-4 py-2"
          disabled={lookupValue.trim() === ""}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Look up
        </Button>
        {lookupState.kind === "invalid" ? (
          <p className="text-xs text-status-danger" role="alert">
            Case IDs look like MT-00000012-1a2b3c4d.
          </p>
        ) : null}
      </form>

      {/* Case list - editorial rows, not a card grid. */}
      <section aria-label="Cases">
        {idsQuery.isLoading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 4 }).map((_, index) => (
              <CaseRowSkeleton key={index} />
            ))}
          </ul>
        ) : idsQuery.isError ? (
          <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-muted">
            {idsQuery.error instanceof ContractReadError
              ? "The case index could not be read right now. Please try again shortly."
              : "The case index is unavailable right now. Please try again shortly."}
          </p>
        ) : (idsQuery.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
            <p className="text-sm font-medium text-ink">
              No cases in this category yet.
            </p>
            <p className="mt-2 text-sm text-muted">
              Cases appear here as they are filed on the protocol.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {detailQueries.map((detailQuery, index) => {
                const disputeId = (idsQuery.data ?? [])[index] ?? "";
                if (detailQuery.isLoading) {
                  return <CaseRowSkeleton key={disputeId || index} />;
                }
                if (detailQuery.isError || detailQuery.data === undefined) {
                  return (
                    <li key={disputeId || index} className="py-5">
                      <p className="text-sm text-muted">
                        This case could not be read right now.
                      </p>
                    </li>
                  );
                }
                const item = detailQuery.data;
                return (
                  <li key={disputeId}>
                    <a
                      href={`/cases/${item.id}`}
                      className="group block py-5 transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <CaseIdChip disputeId={item.id} caseNumber={item.caseNumber} />
                        <span className="rounded-full bg-attest-tint px-2.5 py-0.5 text-xs font-medium text-attest-deep">
                          {item.categoryLabel}
                        </span>
                        <StatusPill status={item.status} />
                      </div>
                      <h3 className="mt-2 text-lg font-medium tracking-tight text-ink group-hover:text-attest-deep">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
                        <AddressChip role="Claimant" address={item.claimant} />
                        <AddressChip role="Respondent" address={item.respondent} />
                        <span className="text-xs text-muted">
                          Filed {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>

            {pageCount > 1 ? (
              <nav
                aria-label="Case list pages"
                className="mt-6 flex items-center justify-between text-sm"
              >
                <Button
                  variant="secondary"
                  className="px-4 py-2"
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1);
                  }}
                >
                  Previous
                </Button>
                <span className="text-muted">
                  Page {page + 1} of {pageCount} - {total} case{total === 1 ? "" : "s"}
                </span>
                <Button
                  variant="secondary"
                  className="px-4 py-2"
                  disabled={page + 1 >= pageCount}
                  onClick={() => {
                    setPage(page + 1);
                  }}
                >
                  Next
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
