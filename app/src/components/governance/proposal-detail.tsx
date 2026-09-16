"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGovernanceParams,
  getGovernanceProposal,
  getProtocolHealth,
  isGovernanceActionApplied,
} from "@/lib/genlayer/reads";
import {
  approveProposal,
  applyGovernanceActionToCore,
  executeProposal,
  toBigIntSafe,
} from "@/lib/genlayer/writes";
import { getInjectedProvider } from "@/lib/wallet/injected";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  actionLabel,
  formatParam,
  PARAM_LABELS,
  proposalStatusLabel,
  type ProtocolParams,
} from "@/lib/metatrial/governance";
import { formatDateTime, formatGenAmount, shortenAddress } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ButtonLink } from "@/components/ui/button";
import { TransactionFlow } from "@/components/writes/transaction-flow";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-xs font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function ProposedValues({
  proposal,
  currentParams,
  treasury,
}: {
  proposal: NonNullable<
    ReturnType<typeof useGovernanceProposalData>["data"]
  >;
  currentParams: ProtocolParams | undefined;
  treasury: { address: string; filingFee: bigint; bond: bigint } | undefined;
}) {
  const type = proposal.action_type;
  return (
    <div className="mt-5 space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Proposed values
      </p>
      <dl className="space-y-2.5 rounded-xl border border-line bg-white px-5 py-4">
        {type === "CORE_PARAM_UPDATE" ? (
          (Object.keys(PARAM_LABELS) as Array<keyof ProtocolParams>).map((key) => {
            const proposed = Number(proposal[`param_${key}` as keyof typeof proposal]);
            const current = currentParams === undefined ? null : currentParams[key];
            return (
              <Row key={key} label={PARAM_LABELS[key]}>
                {formatParam(key, proposed)}
                {current !== null && current !== proposed ? (
                  <span className="ml-2 text-xs text-muted">
                    (currently {formatParam(key, current)})
                  </span>
                ) : null}
              </Row>
            );
          })
        ) : null}
        {type === "TREASURY_UPDATE" ? (
          <>
            <Row label="Treasury address">
              <span className="font-mono text-xs" title={proposal.param_treasury_address}>
                {proposal.param_treasury_address === ""
                  ? "not set"
                  : proposal.param_treasury_address}
              </span>
              {treasury !== undefined && treasury.address !== proposal.param_treasury_address ? (
                <span className="ml-2 text-xs text-muted">
                  (currently {treasury.address === "" ? "not configured" : shortenAddress(treasury.address)})
                </span>
              ) : null}
            </Row>
            <Row label="Filing fee">
              {formatGenAmount(toBigIntSafe(proposal.param_dispute_filing_fee))}
              <span className="ml-2 font-mono text-xs text-muted">
                ({toBigIntSafe(proposal.param_dispute_filing_fee).toString()} wei)
              </span>
            </Row>
            <Row label="Appeal bond">
              {formatGenAmount(toBigIntSafe(proposal.param_appeal_bond_amount))}
              <span className="ml-2 font-mono text-xs text-muted">
                ({toBigIntSafe(proposal.param_appeal_bond_amount).toString()} wei)
              </span>
            </Row>
          </>
        ) : null}
        {type === "ADD_ADMIN" || type === "REMOVE_ADMIN" ? (
          <Row label="Target address">
            <span className="font-mono text-xs" title={proposal.target_hex}>
              {proposal.target_hex}
            </span>
          </Row>
        ) : null}
        {type === "EXTERNAL_SOURCE_UPDATE" ? (
          <Row label="URL prefix">
            <span className="break-all font-mono text-xs" title={proposal.target_hex}>
              {proposal.target_hex}
            </span>
            <span
              className={cn(
                "ml-2 text-xs",
                proposal.param_external_source_active === true
                  ? "text-attest-deep"
                  : "text-status-danger",
              )}
            >
              {proposal.param_external_source_active === true ? "activate" : "deactivate"}
            </span>
          </Row>
        ) : null}
        {type === "PAUSE" ? (
          <Row label="Effect">
            Pauses new case filings. In-flight cases always continue.
          </Row>
        ) : null}
        {type === "UNPAUSE" ? (
          <Row label="Effect">Lifts the filing pause.</Row>
        ) : null}
      </dl>
    </div>
  );
}

function useGovernanceProposalData(proposalId: string) {
  return useQuery({
    queryKey: ["metatrial", "governance-proposal", proposalId],
    queryFn: () => getGovernanceProposal(proposalId),
    staleTime: 15_000,
    retry: false,
  });
}

export function ProposalDetail({ proposalId }: { proposalId: string }) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const proposalQuery = useGovernanceProposalData(proposalId);
  const paramsQuery = useQuery({
    queryKey: ["metatrial", "governance-params"],
    queryFn: getGovernanceParams,
    staleTime: 15_000,
    enabled: proposalQuery.data?.action_type === "CORE_PARAM_UPDATE",
  });
  const healthQuery = useQuery({
    queryKey: ["metatrial", "protocol-health"],
    queryFn: getProtocolHealth,
    staleTime: 15_000,
    enabled: proposalQuery.data?.action_type === "TREASURY_UPDATE",
  });
  const appliedQuery = useQuery({
    queryKey: ["metatrial", "governance-action-applied", proposalId],
    queryFn: () => isGovernanceActionApplied(proposalId),
    enabled:
      proposalQuery.data !== undefined &&
      (proposalQuery.data.action_type === "CORE_PARAM_UPDATE" ||
        proposalQuery.data.action_type === "TREASURY_UPDATE") &&
      proposalQuery.data.status === "EXECUTED",
    staleTime: 15_000,
  });

  const proposal = proposalQuery.data;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const needsCoreApply =
    proposal !== undefined &&
    proposal.status === "EXECUTED" &&
    (proposal.action_type === "CORE_PARAM_UPDATE" ||
      proposal.action_type === "TREASURY_UPDATE");

  if (proposalQuery.isLoading) {
    return (
      <div className="max-w-3xl animate-pulse space-y-3 py-4">
        <div className="h-4 w-48 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
      </div>
    );
  }
  if (proposalQuery.isError || proposal === undefined) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="font-serif text-2xl tracking-tight text-ink">
          This proposal could not be read.
        </h1>
        <ButtonLink href="/governance" variant="secondary">
          Back to governance
        </ButtonLink>
      </div>
    );
  }

  const status = proposalStatusLabel(proposal.status);
  const canApprove =
    proposal.status === "PENDING_APPROVALS" &&
    wallet.address !== null &&
    wallet.address.toLowerCase() !== proposal.proposer_hex.toLowerCase();
  const canExecute =
    (proposal.status === "TIMELOCKED" ||
      proposal.status === "PENDING_APPROVALS") &&
    proposal.ready_at > 0 &&
    nowSeconds >= proposal.ready_at;
  const treasury =
    healthQuery.data === undefined
      ? undefined
      : {
          address: healthQuery.data.treasury_address,
          filingFee: toBigIntSafe(healthQuery.data.dispute_filing_fee),
          bond: toBigIntSafe(healthQuery.data.appeal_bond_amount),
        };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-xs text-muted">{proposal.proposal_id}</span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              status.tone === "final"
                ? "border-attest bg-attest text-paper"
                : status.tone === "pending"
                  ? "border-status-pending/40 bg-status-pending/10 text-status-pending"
                  : status.tone === "active"
                    ? "border-attest/40 bg-attest-tint text-attest-deep"
                    : status.tone === "danger"
                      ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                      : "border-line bg-white text-muted",
            )}
          >
            {status.label}
          </span>
          <span className="text-sm font-medium text-ink">
            {actionLabel(proposal.action_type)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Proposed by {shortenAddress(proposal.proposer_hex)} ·{" "}
          {formatDateTime(proposal.created_at)}
        </p>
      </div>

      <dl className="grid gap-4 rounded-xl border border-line bg-white px-5 py-4 sm:grid-cols-2">
        <Row label="Approvals">
          <span className="tabular-nums">
            {proposal.valid_approvals_now}/{proposal.current_threshold} current admins
          </span>
        </Row>
        <Row label="Proposer">
          <span className="font-mono text-xs">{shortenAddress(proposal.proposer_hex)}</span>
          {" "}
          <span className="text-xs text-muted">(proposer cannot self-approve)</span>
        </Row>
        <Row label="Approval window">
          Expires {formatDateTime(proposal.expires_at)}
          {proposal.status === "PENDING_APPROVALS" && nowSeconds > proposal.expires_at
            ? " (elapsed - will formalize on next interaction)"
            : ""}
        </Row>
        <Row label="Execution">
          {proposal.ready_at > 0
            ? `Ready ${formatDateTime(proposal.ready_at)}${
                canExecute === true ? " - timelock has elapsed" : ""
              }`
            : proposal.threshold_reached_at > 0
              ? "Awaiting timelock start"
              : "Threshold not reached yet"}
        </Row>
      </dl>

      <ProposedValues
        proposal={proposal}
        currentParams={paramsQuery.data?.active}
        treasury={treasury}
      />

      {needsCoreApply === true ? (
        <div
          className={cn(
            "rounded-xl border px-5 py-4",
            appliedQuery.data === true
              ? "border-attest/40 bg-attest-tint"
              : "border-status-pending/40 bg-status-pending/10",
          )}
        >
          <p className="text-sm font-medium text-ink">
            {appliedQuery.data === true
              ? "Core has applied this authorized change."
              : "Executed - Core has not pulled this authorization yet."}
          </p>
          {appliedQuery.data === true ? null : (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Governance authorizes; Core applies. Any wallet can trigger the
              pull - parameters activate in Core immediately (the authorization
              itself was already timelocked).
            </p>
          )}
        </div>
      ) : null}

      {proposal.status === "PENDING_APPROVALS" && canApprove === true ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Approve (admin action)
          </p>
          <TransactionFlow
            triggerLabel="Sign approval"
            review={
              <p className="text-sm leading-relaxed text-ink">
                You are approving this proposal as an admin. Approval is
                one-per-admin, tracked against live admin membership, and the
                proposer cannot approve their own proposal.
              </p>
            }
            run={() =>
              approveProposal({
                walletAddress: wallet.address ?? "",
                provider: getInjectedProvider(),
                proposalId: proposal.proposal_id,
              })
            }
            processingTitle="Recording the approval"
            successTitle="Approval recorded."
            successNote="When the threshold is reached, the proposal enters its timelock."
            onSucceeded={() => {
              void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
            }}
          />
        </div>
      ) : null}

      {canExecute === true && proposal.status !== "EXECUTED" && proposal.status !== "EXPIRED" ? (
        <div className="rounded-xl border border-attest bg-attest px-5 py-4">
          <p className="text-sm font-semibold text-paper">Execute (distinct from approve)</p>
          <p className="mt-1.5 text-sm leading-relaxed text-paper/90">
            The timelock has elapsed. Execution is permissionless and exactly-once
            - it applies the proposal&apos;s action on the governance contract.
          </p>
          <div className="mt-3">
            <TransactionFlow
              triggerLabel="Execute this proposal"
              run={() =>
                executeProposal({
                  walletAddress: wallet.address ?? "",
                  provider: getInjectedProvider(),
                  proposalId: proposal.proposal_id,
                })
              }
              processingTitle="Executing the proposal"
              successTitle="Proposal executed."
              successNote={
                needsCoreApply === true
                  ? "Core still needs to pull the authorized values - use the action below."
                  : "The change is now in effect."
              }
              onSucceeded={() => {
                void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
              }}
            />
          </div>
        </div>
      ) : null}

      {needsCoreApply === true && appliedQuery.data === false ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Apply to Core (permissionless)
          </p>
          <TransactionFlow
            triggerLabel="Pull the authorized values into Core"
            run={() =>
              applyGovernanceActionToCore({
                walletAddress: wallet.address ?? "",
                provider: getInjectedProvider(),
                proposalId: proposal.proposal_id,
              })
            }
            processingTitle="Applying the authorized change to Core"
            successTitle="Core has applied the change."
            onSucceeded={() => {
              void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
            }}
          />
        </div>
      ) : null}

    </div>
  );
}
