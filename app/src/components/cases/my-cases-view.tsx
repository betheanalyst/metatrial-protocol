"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getDisputesByAddress,
  getDispute,
  getVerdictHistory,
  getProtocolInfo,
} from "@/lib/genlayer/reads";
import { toCaseDetail, toDetermination } from "@/lib/metatrial/mappers";
import type { CaseDetail } from "@/lib/metatrial/types";
import { classifyMyCase, type MyCaseBucket } from "@/lib/metatrial/my-cases";
import { formatDate } from "@/lib/utils/format";
import { useWallet } from "@/lib/wallet/wallet-context";
import { AddressChip, CaseIdChip, StatusPill } from "./case-parts";

interface MyCaseEntry {
  detail: CaseDetail;
  role: "claimant" | "respondent";
  bucket: MyCaseBucket;
  actionLabel: string | null;
  note: string;
}

function MyCaseRow({ entry }: { entry: MyCaseEntry }) {
  const { detail, actionLabel, note, role } = entry;
  return (
    <li className="py-5">
      <Link href={`/cases/${detail.id}?from=my-cases`} className="group block">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CaseIdChip disputeId={detail.id} caseNumber={detail.caseNumber} />
          <span className="rounded-full bg-attest-tint px-2.5 py-0.5 text-xs font-medium text-attest-deep">
            {role === "claimant" ? "You filed" : "Against you"}
          </span>
          <StatusPill status={detail.status} />
          {actionLabel !== null ? (
            <span className="rounded-full border border-attest bg-attest px-2.5 py-0.5 text-xs font-medium text-paper">
              {actionLabel}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-lg font-medium tracking-tight text-ink group-hover:text-attest-deep">
          {detail.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
          <AddressChip role="Claimant" address={detail.claimant} />
          <AddressChip role="Respondent" address={detail.respondent} />
          <span className="text-xs text-muted">Filed {formatDate(detail.createdAt)}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{note}</p>
      </Link>
    </li>
  );
}

function Section({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: MyCaseEntry[];
  emptyText: string;
}) {
  return (
    <section aria-label={title} className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">{entries.map((entry) => (
          <MyCaseRow key={`${entry.role}-${entry.detail.id}`} entry={entry} />
        ))}</ul>
      )}
    </section>
  );
}

export function MyCasesView() {
  const wallet = useWallet();

  const claimantIdsQuery = useQuery({
    queryKey: ["metatrial", "my-cases", "claimant", wallet.address ?? ""],
    queryFn: () => getDisputesByAddress(wallet.address ?? "", "claimant", 0, 50),
    enabled: wallet.status === "connected" && wallet.address !== null,
    staleTime: 15_000,
  });
  const respondentIdsQuery = useQuery({
    queryKey: ["metatrial", "my-cases", "respondent", wallet.address ?? ""],
    queryFn: () => getDisputesByAddress(wallet.address ?? "", "respondent", 0, 50),
    enabled: wallet.status === "connected" && wallet.address !== null,
    staleTime: 15_000,
  });
  const protocolInfoQuery = useQuery({
    queryKey: ["metatrial", "protocol-info"],
    queryFn: getProtocolInfo,
    staleTime: 5 * 60_000,
  });

  const claimantIds = claimantIdsQuery.data ?? [];
  const respondentIds = respondentIdsQuery.data ?? [];

  // One deduped id list; the role comes from which index produced the id.
  // (A wallet can be claimant on one case and respondent on another, so the
  // same id must never appear in both lists - the contract forbids it.)
  const roleById = new Map<string, "claimant" | "respondent">();
  for (const disputeId of claimantIds) {
    if (roleById.has(disputeId) === false) {
      roleById.set(disputeId, "claimant");
    }
  }
  for (const disputeId of respondentIds) {
    if (roleById.has(disputeId) === false) {
      roleById.set(disputeId, "respondent");
    }
  }

  // NOTE: this query key is shared with the case page (useDispute), so the
  // cached shape MUST be the canonical CaseDetail - never a wrapper. The
  // role is resolved from roleById outside the cache.
  const detailQueries = useQueries({
    queries: [...roleById.keys()].map((disputeId) => ({
      queryKey: ["metatrial", "dispute", disputeId],
      queryFn: async () => toCaseDetail(await getDispute(disputeId)),
      staleTime: 15_000,
    })),
  });

  // Latest-round context per case, for appeal-window classification. Shares
  // the same query key (and Determination[] shape) as the case page.
  const verdictHistoryQueries = useQueries({
    queries: detailQueries
      .filter((entry) => entry.data?.hasVerdict === true)
      .map((entry) => ({
        queryKey: ["metatrial", "verdict-history", entry.data?.id ?? ""],
        queryFn: async () => {
          // Same Determination[] shape the case page stores under this key.
          const history = await getVerdictHistory(entry.data?.id ?? "");
          return history.map((raw, index) =>
            toDetermination(raw, index === history.length - 1),
          );
        },
        staleTime: 15_000,
      })),
  });

  if (wallet.status !== "connected" || wallet.address === null) {
    return (
      <div className="rounded-xl border border-line bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-ink">
          Connect your wallet to open your action center.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          My Cases lists only cases you are a party to. Browsing and
          verification remain public and wallet-free.
        </p>
      </div>
    );
  }

  if (claimantIdsQuery.isLoading || respondentIdsQuery.isLoading) {
    return (
      <div className="max-w-3xl animate-pulse space-y-3 py-4">
        <div className="h-4 w-48 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
      </div>
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const appealWindowSeconds = protocolInfoQuery.data?.governance.appeal_window ?? null;

  const entries: MyCaseEntry[] = [];
  detailQueries.forEach((entry, index) => {
    const detail = entry.data;
    if (detail === undefined) {
      return;
    }
    const role = roleById.get(detail.id) ?? "claimant";
    const history = verdictHistoryQueries[index]?.data ?? [];
    const latest = history[history.length - 1] ?? null;
    const classification = classifyMyCase(role, detail, {
      nowSeconds,
      currentAppealRound: latest?.appealRound ?? null,
      currentVerdictRenderedAt: latest?.renderedAt ?? null,
      appealWindowSeconds,
    });
    entries.push({
      detail,
      role,
      bucket: classification.bucket,
      actionLabel: classification.actionLabel,
      note: classification.note,
    });
  });

  const needsAction = entries.filter((entry) => entry.bucket === "needs-action");
  const active = entries.filter((entry) => entry.bucket === "active");
  const completed = entries.filter((entry) => entry.bucket === "completed");
  const attestations = entries.filter(
    (entry) => entry.detail.status.key === "FINALIZED" && entry.detail.attestationId !== null,
  );

  return (
    <div className="space-y-10">
      <Section
        title="Needs your action"
        entries={needsAction}
        emptyText="Nothing needs your attention right now."
      />
      <Section
        title="Active"
        entries={active}
        emptyText="No active cases."
      />
      <Section
        title="Completed"
        entries={completed}
        emptyText="No completed cases yet."
      />
      <section aria-label="Your attestations" className="border-t border-line pt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Your attestations
        </h2>
        {attestations.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Attestations appear here once your finalized cases are mirrored to
            the public registry.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attestations.map((entry) => (
              <li key={entry.detail.attestationId ?? ""} className="text-sm">
                <Link
                  href={`/verify/${entry.detail.attestationId}`}
                  className="font-mono text-xs text-attest underline-offset-4 hover:underline"
                >
                  {entry.detail.attestationId}
                </Link>
                {" "}
                <span className="text-muted">- {entry.detail.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
