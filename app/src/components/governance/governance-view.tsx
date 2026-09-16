"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getGovernanceInfo,
  getGovernanceParams,
  getGovernanceProposal,
  getGovernanceProposalIds,
  getProtocolHealth,
  isExternalSourceActive,
  isGovernanceAdmin,
} from "@/lib/genlayer/reads";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  actionLabel,
  formatParam,
  PARAM_LABELS,
  proposalStatusLabel,
  type ProtocolParams,
} from "@/lib/metatrial/governance";
import { formatDateTime, shortenAddress } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const PROPOSALS_PAGE_SIZE = 12;

function AdminGate({ connected }: { connected: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">
        {connected
          ? "Administrator access only."
          : "Connect an administrator wallet to open governance."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Governance is an isolated administrative experience. It never appears
        in public navigation, and ordinary users cannot see or affect protocol
        administration here.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const state = proposalStatusLabel(status);
  const classes: Record<string, string> = {
    pending: "border-status-pending/40 bg-status-pending/10 text-status-pending",
    active: "border-attest/40 bg-attest-tint text-attest-deep",
    final: "border-attest bg-attest text-paper",
    muted: "border-line bg-white text-muted",
    danger: "border-status-danger/40 bg-status-danger/10 text-status-danger",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        classes[state.tone],
      )}
    >
      {state.label}
    </span>
  );
}

export { StatusBadge };

function OverviewSection() {
  const infoQuery = useQuery({
    queryKey: ["metatrial", "governance-info"],
    queryFn: getGovernanceInfo,
    staleTime: 15_000,
  });
  const healthQuery = useQuery({
    queryKey: ["metatrial", "protocol-health"],
    queryFn: getProtocolHealth,
    staleTime: 15_000,
  });
  const info = infoQuery.data;
  if (info === undefined) {
    return null;
  }
  return (
    <section aria-label="Overview" className="border-t border-line pt-8">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Overview
      </h2>
      <dl className="mt-4 grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Active admins</dt>
          <dd className="mt-1 text-sm text-ink">
            {info.active_admin_count} of 5 seats
            {info.bootstrap_complete === false ? " (bootstrap phase)" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Approval threshold</dt>
          <dd className="mt-1 text-sm text-ink">
            {info.current_threshold === null
              ? "n/a (bootstrap)"
              : `${info.current_threshold} of ${info.active_admin_count}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Protocol paused</dt>
          <dd className={cn("mt-1 text-sm", info.paused === true ? "text-status-danger" : "text-ink")}>
            {info.paused === true ? "Paused - new filings blocked" : "Not paused"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pending proposals</dt>
          <dd className="mt-1 text-sm tabular-nums text-ink">{info.pending_proposals}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Total proposals</dt>
          <dd className="mt-1 text-sm tabular-nums text-ink">{info.total_proposals}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Treasury</dt>
          <dd className="mt-1 text-sm text-ink">
            {healthQuery.data === undefined
              ? "\u2026"
              : healthQuery.data.treasury_address === ""
                ? "Not configured (fees inactive)"
                : shortenAddress(healthQuery.data.treasury_address)}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-xs text-muted">Admin seats</p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {info.admins.map((admin) => (
            <li
              key={admin}
              title={admin}
              className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-ink"
            >
              {shortenAddress(admin)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProposalsSection() {
  const [page, setPage] = useState(0);
  const idsQuery = useQuery({
    queryKey: ["metatrial", "governance-proposal-ids", page],
    queryFn: () => getGovernanceProposalIds(page * PROPOSALS_PAGE_SIZE, PROPOSALS_PAGE_SIZE),
    staleTime: 15_000,
  });
  const ids = idsQuery.data ?? [];
  const detailQueries = useQueries({
    queries: ids.map((proposalId) => ({
      queryKey: ["metatrial", "governance-proposal", proposalId],
      queryFn: () => getGovernanceProposal(proposalId),
      staleTime: 15_000,
    })),
  });

  return (
    <section aria-label="Proposals" className="border-t border-line pt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Proposals
        </h2>
        <Link
          href="/governance/new"
          className="rounded-full border border-attest bg-attest px-4 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-attest-deep"
        >
          New proposal
        </Link>
      </div>
      {ids.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No proposals yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {detailQueries.map((entry, index) => {
            const proposalId = ids[index] ?? "";
            const proposal = entry.data;
            if (proposal === undefined) {
              return (
                <li key={proposalId || index} className="animate-pulse py-4">
                  <div className="h-3 w-1/2 rounded bg-line" />
                </li>
              );
            }
            return (
              <li key={proposalId} className="py-4">
                <Link
                  href={`/governance/proposals/${proposal.proposal_id}`}
                  className="group block"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-mono text-xs text-muted">
                      {proposal.proposal_id}
                    </span>
                    <span className="text-sm font-medium text-ink group-hover:text-attest-deep">
                      {actionLabel(proposal.action_type)}
                    </span>
                    <StatusBadge status={proposal.status} />
                    <span className="text-xs text-muted">
                      {proposal.valid_approvals_now}/{proposal.current_threshold} approvals
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Proposed by {shortenAddress(proposal.proposer_hex)} ·{" "}
                    {formatDateTime(proposal.created_at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {ids.length === PROPOSALS_PAGE_SIZE ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setPage(page + 1);
            }}
            className="text-sm text-attest underline-offset-4 hover:underline"
          >
            Older proposals
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SettingsSection() {
  const paramsQuery = useQuery({
    queryKey: ["metatrial", "governance-params"],
    queryFn: getGovernanceParams,
    staleTime: 15_000,
  });
  const [checkUrl, setCheckUrl] = useState("");
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const params = paramsQuery.data;

  return (
    <section aria-label="Settings" className="border-t border-line pt-8">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Settings
      </h2>
      {params === undefined ? (
        <p className="mt-4 text-sm text-muted">Loading protocol parameters\u2026</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Parameter</th>
                <th className="px-4 py-2.5 font-medium">Active value</th>
                {params.pending_activation_time > 0 ? (
                  <th className="px-4 py-2.5 font-medium">
                    Pending (activates {formatDateTime(params.pending_activation_time)})
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PARAM_LABELS) as Array<keyof ProtocolParams>).map((key) => (
                <tr key={key} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 text-muted">{PARAM_LABELS[key]}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ink">
                    {formatParam(key, params.active[key])}
                  </td>
                  {params.pending_activation_time > 0 ? (
                    <td className="px-4 py-2.5 tabular-nums text-ink">
                      {params.pending[key] === params.active[key]
                        ? "-"
                        : formatParam(key, params.pending[key])}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 max-w-xl">
        <p className="text-xs text-muted">External source whitelist check</p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const url = checkUrl.trim();
            if (url === "") {
              return;
            }
            void isExternalSourceActive(url)
              .then((active) => {
                setCheckResult(active);
              })
              .catch(() => {
                setCheckResult(false);
              });
          }}
        >
          <input
            value={checkUrl}
            onChange={(event) => {
              setCheckUrl(event.target.value);
            }}
            placeholder="https://\u2026 prefix check"
            spellCheck={false}
            className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-attest focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm text-ink hover:border-ink/60"
          >
            Check
          </button>
        </form>
        {checkResult !== null ? (
          <p className={cn("mt-2 text-xs", checkResult === true ? "text-attest-deep" : "text-status-danger")}>
            {checkResult === true
              ? "Covered by an active whitelist entry."
              : "Not covered by any active whitelist entry."}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          The whitelist is prefix-matched and cannot be enumerated on-chain -
          individual URLs can only be checked against it.
        </p>
      </div>
    </section>
  );
}

export function GovernanceView() {
  const wallet = useWallet();
  const connected = wallet.status === "connected" && wallet.address !== null;
  const adminQuery = useQuery({
    queryKey: ["metatrial", "is-admin", wallet.address ?? ""],
    queryFn: () => isGovernanceAdmin(wallet.address ?? ""),
    enabled: connected,
    staleTime: 60_000,
  });

  if (connected === false || (adminQuery.data === false && adminQuery.isLoading === false)) {
    return <AdminGate connected={connected} />;
  }
  if (adminQuery.isLoading || adminQuery.data === undefined) {
    return (
      <div className="max-w-3xl animate-pulse space-y-3 py-4">
        <div className="h-4 w-48 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <p className="max-w-article text-sm leading-relaxed text-muted">
        Administrative instrument for the MetaTrial protocol: admin seats,
        parameter authorization, emergency pause, treasury, and the external
        source whitelist. Changes flow through multisig approval and a
        timelock - Core always applies authorized values itself.
      </p>
      <OverviewSection />
      <ProposalsSection />
      <SettingsSection />
    </div>
  );
}
