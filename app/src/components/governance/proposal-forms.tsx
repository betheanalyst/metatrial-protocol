"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGovernanceInfo,
  getGovernanceParams,
  isGovernanceAdmin,
} from "@/lib/genlayer/reads";
import {
  proposeAddAdmin,
  proposeCoreParamUpdate,
  proposeExternalSourceUpdate,
  proposePause,
  proposeRemoveAdmin,
  proposeTreasuryUpdate,
  proposeUnpause,
  type WriteOutcome,
} from "@/lib/genlayer/writes";
import { getInjectedProvider } from "@/lib/wallet/injected";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  PARAM_LABELS,
  actionLabel,
  formatParam,
  type ProtocolParams,
} from "@/lib/metatrial/governance";
import {
  PARAM_RANGES,
  parseGenToWei,
  validateProposal,
  type ProposalActionType,
  type ProposalDraft,
} from "@/lib/metatrial/proposal-validation";
import { cn } from "@/lib/utils/cn";
import { formatGenAmount } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { TransactionFlow } from "@/components/writes/transaction-flow";

const ACTION_OPTIONS: Array<{
  type: ProposalActionType;
  description: string;
}> = [
  { type: "CORE_PARAM_UPDATE", description: "All six arbitration parameters, specified together." },
  { type: "TREASURY_UPDATE", description: "Treasury address, filing fee, and appeal bond." },
  { type: "ADD_ADMIN", description: "Grant an admin seat (multisig-approved)." },
  { type: "REMOVE_ADMIN", description: "Remove an admin seat." },
  { type: "EXTERNAL_SOURCE_UPDATE", description: "Activate or deactivate an external precedent source prefix." },
  { type: "PAUSE", description: "Emergency pause: blocks new filings only." },
  { type: "UNPAUSE", description: "Lifts the filing pause." },
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-attest focus:outline-none";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      {children}
      {hint !== undefined && error === undefined ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
      {error !== undefined ? (
        <p className="mt-1 text-xs text-status-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const DEFAULT_PARAMS: ProposalDraft["params"] = {
  participation_window: 172_800,
  appeal_window: 259_200,
  max_appeal_rounds: 2,
  confidence_tolerance: 15,
  max_disputes_per_respondent_window: 10,
  max_disputes_per_claimant_window: 20,
};

function initialDraft(): ProposalDraft {
  return {
    actionType: "CORE_PARAM_UPDATE",
    targetAddress: "",
    params: { ...DEFAULT_PARAMS },
    filingFeeGen: "0",
    bondGen: "0",
    treasuryAddress: "",
    externalPrefix: "",
    externalActive: true,
  };
}

function formatWeiPreview(gen: string): string {
  const wei = parseGenToWei(gen === "" ? "0" : gen);
  if (wei === null) {
    return "invalid amount";
  }
  return `${formatGenAmount(wei)} (${wei.toString()} wei)`;
}

export function ProposalCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const connected = wallet.status === "connected" && wallet.address !== null;
  const adminQuery = useQuery({
    queryKey: ["metatrial", "is-admin", wallet.address ?? ""],
    queryFn: () => isGovernanceAdmin(wallet.address ?? ""),
    enabled: connected,
    staleTime: 60_000,
  });
  const infoQuery = useQuery({
    queryKey: ["metatrial", "governance-info"],
    queryFn: getGovernanceInfo,
    staleTime: 15_000,
    enabled: adminQuery.data === true,
  });
  const paramsQuery = useQuery({
    queryKey: ["metatrial", "governance-params"],
    queryFn: getGovernanceParams,
    staleTime: 15_000,
    enabled: adminQuery.data === true,
  });

  const [draft, setDraft] = useState<ProposalDraft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paramsTouched, setParamsTouched] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Prefill parameters from the live active values once, before the admin
  // edits anything - proposing "all current values" is the natural default.
  useEffect(() => {
    const active = paramsQuery.data?.active;
    if (active === undefined || paramsTouched === true) {
      return;
    }
    setDraft((prev) => ({ ...prev, params: { ...active } }));
  }, [paramsQuery.data, paramsTouched]);

  function update<K extends keyof ProposalDraft>(key: K, value: ProposalDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (prev[key] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateParam(key: keyof ProtocolParams, value: number) {
    setParamsTouched(true);
    setDraft((prev) => ({ ...prev, params: { ...prev.params, [key]: value } }));
    setErrors((prev) => {
      if (prev[`param_${key}`] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[`param_${key}`];
      return next;
    });
  }

  function validateStep(): boolean {
    const validation = validateProposal(draft, {
      admins: infoQuery.data?.admins ?? [],
      activeAdminCount: infoQuery.data?.active_admin_count ?? 0,
      bootstrapComplete: infoQuery.data?.bootstrap_complete ?? false,
      paused: infoQuery.data?.paused ?? false,
    });
    setErrors(validation);
    return Object.keys(validation).length === 0;
  }

  async function run(): Promise<WriteOutcome> {
    const opts = {
      walletAddress: wallet.address ?? "",
      provider: getInjectedProvider(),
    };
    if (wallet.address === null) {
      return {
        status: "failed",
        primary: "Connect the administrator wallet first.",
        raw: null,
        hash: null,
      };
    }
    switch (draft.actionType) {
      case "ADD_ADMIN":
        return proposeAddAdmin({ ...opts, targetAddress: draft.targetAddress.trim() });
      case "REMOVE_ADMIN":
        return proposeRemoveAdmin({ ...opts, targetAddress: draft.targetAddress.trim() });
      case "CORE_PARAM_UPDATE":
        return proposeCoreParamUpdate({
          ...opts,
          input: {
            participationWindow: draft.params.participation_window,
            appealWindow: draft.params.appeal_window,
            maxAppealRounds: draft.params.max_appeal_rounds,
            confidenceTolerance: draft.params.confidence_tolerance,
            maxDisputesPerRespondentWindow:
              draft.params.max_disputes_per_respondent_window,
            maxDisputesPerClaimantWindow:
              draft.params.max_disputes_per_claimant_window,
          },
        });
      case "TREASURY_UPDATE": {
        const filingFeeWei = parseGenToWei(draft.filingFeeGen === "" ? "0" : draft.filingFeeGen);
        const bondWei = parseGenToWei(draft.bondGen === "" ? "0" : draft.bondGen);
        if (filingFeeWei === null || bondWei === null) {
          return {
            status: "failed",
            primary: "The fee amounts could not be parsed. Review them and try again.",
            raw: null,
            hash: null,
          };
        }
        return proposeTreasuryUpdate({
          ...opts,
          filingFeeWei,
          bondWei,
          treasuryAddress: draft.treasuryAddress.trim(),
        });
      }
      case "EXTERNAL_SOURCE_UPDATE":
        return proposeExternalSourceUpdate({
          ...opts,
          urlPrefix: draft.externalPrefix.trim(),
          active: draft.externalActive,
        });
      case "PAUSE":
        return proposePause(opts);
      case "UNPAUSE":
        return proposeUnpause(opts);
    }
  }

  if (connected === false || (adminQuery.data === false && adminQuery.isLoading === false)) {
    return (
      <div className="rounded-xl border border-line bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-ink">
          {connected
            ? "Administrator access only."
            : "Connect an administrator wallet to propose changes."}
        </p>
      </div>
    );
  }
  if (adminQuery.isLoading) {
    return (
      <div className="max-w-3xl animate-pulse space-y-3 py-4">
        <div className="h-4 w-48 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6 rounded-2xl border border-line bg-white px-6 py-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Review - exactly what will be proposed
          </p>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-44 shrink-0 text-muted">Action</dt>
              <dd className="text-ink">{actionLabel(draft.actionType)}</dd>
            </div>
            {draft.actionType === "ADD_ADMIN" || draft.actionType === "REMOVE_ADMIN" ? (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="w-44 shrink-0 text-muted">Target address</dt>
                <dd className="break-all font-mono text-xs text-ink">{draft.targetAddress.trim()}</dd>
              </div>
            ) : null}
            {draft.actionType === "CORE_PARAM_UPDATE"
              ? (Object.keys(PARAM_LABELS) as Array<keyof ProtocolParams>).map((key) => (
                  <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                    <dt className="w-44 shrink-0 text-muted">{PARAM_LABELS[key]}</dt>
                    <dd className="tabular-nums text-ink">{formatParam(key, draft.params[key])}</dd>
                  </div>
                ))
              : null}
            {draft.actionType === "TREASURY_UPDATE" ? (
              <>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 text-muted">Treasury</dt>
                  <dd className="break-all font-mono text-xs text-ink">{draft.treasuryAddress.trim()}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 text-muted">Filing fee</dt>
                  <dd className="tabular-nums text-ink">
                    {formatWeiPreview(draft.filingFeeGen)}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 text-muted">Appeal bond</dt>
                  <dd className="tabular-nums text-ink">
                    {formatWeiPreview(draft.bondGen)}
                  </dd>
                </div>
              </>
            ) : null}
            {draft.actionType === "EXTERNAL_SOURCE_UPDATE" ? (
              <>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 text-muted">URL prefix</dt>
                  <dd className="break-all font-mono text-xs text-ink">{draft.externalPrefix.trim()}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 text-muted">Effect</dt>
                  <dd className="text-ink">{draft.externalActive === true ? "Activate" : "Deactivate"}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        <div className="rounded-xl bg-attest-tint px-4 py-3 text-sm text-attest-deep">
          Creating this proposal registers your creation act as the first
          approval. Other admins approve within 24 hours; once the threshold
          is reached the proposal timelocks, and execution applies it. You
          cannot approve your own proposal later.
        </div>

        <TransactionFlow
          triggerLabel="Sign & create the proposal"
          run={run}
          processingTitle="Creating the proposal"
          processingNote="The proposal is being recorded on the governance contract."
          successTitle="Proposal created."
          successNote="Other admins can now approve it - track it in the proposals list."
          secondaryLabel="Edit proposal"
          onSucceeded={() => {
            void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
            router.push("/governance");
          }}
        />

        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setStep(1);
            }}
          >
            Back to editing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-white px-6 py-6">
      <Field label="Action type" error={errors.actionType}>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {ACTION_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => {
                update("actionType", option.type);
              }}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors",
                draft.actionType === option.type
                  ? "border-attest bg-attest-tint"
                  : "border-line hover:border-ink/40",
              )}
            >
              <p className="text-sm font-medium text-ink">{actionLabel(option.type)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{option.description}</p>
            </button>
          ))}
        </div>
      </Field>

      {draft.actionType === "ADD_ADMIN" || draft.actionType === "REMOVE_ADMIN" ? (
        <Field
          label="Target address"
          hint={
            draft.actionType === "ADD_ADMIN"
              ? `The wallet to grant a seat (up to ${5} active admins).`
              : "The wallet whose seat to remove."
          }
          error={errors.targetAddress}
        >
          <input
            value={draft.targetAddress}
            onChange={(event) => {
              update("targetAddress", event.target.value);
            }}
            placeholder="0x\u2026"
            spellCheck={false}
            className={cn(inputClass, "font-mono text-xs")}
          />
        </Field>
      ) : null}

      {draft.actionType === "CORE_PARAM_UPDATE" ? (
        <div className="space-y-4">
          {(Object.keys(PARAM_RANGES) as Array<keyof typeof PARAM_RANGES>).map((key) => (
            <Field
              key={key}
              label={PARAM_LABELS[key]}
              hint={
                (key === "participation_window" || key === "appeal_window"
                  ? `Range ${PARAM_RANGES[key].min} to ${PARAM_RANGES[key].max} (in seconds)`
                  : `Range ${PARAM_RANGES[key].min} to ${PARAM_RANGES[key].max}`) +
                (key === "max_appeal_rounds" ? " - even numbers only" : "") +
                "."
              }
              error={errors[`param_${key}`]}
            >
              <input
                type="number"
                value={draft.params[key]}
                min={PARAM_RANGES[key].min}
                max={PARAM_RANGES[key].max}
                onChange={(event) => {
                  updateParam(key, Number(event.target.value));
                }}
                className={cn(inputClass, "tabular-nums")}
              />
              <p className="mt-1 text-xs text-muted">
                Current: {formatParam(key, draft.params[key])}
                {key === "max_appeal_rounds"
                  ? ` (${Math.floor(draft.params[key] / 2)} per party)`
                  : ""}
              </p>
            </Field>
          ))}
        </div>
      ) : null}

      {draft.actionType === "TREASURY_UPDATE" ? (
        <div className="space-y-4">
          <Field
            label="Treasury address"
            hint="Receives all forfeited filing fees and appeal bonds."
            error={errors.treasuryAddress}
          >
            <input
              value={draft.treasuryAddress}
              onChange={(event) => {
                update("treasuryAddress", event.target.value);
              }}
              placeholder="0x\u2026"
              spellCheck={false}
              className={cn(inputClass, "font-mono text-xs")}
            />
          </Field>
          <Field
            label="Filing fee (GEN)"
            hint="Exact wei amount attached at filing. 0 means filing stays free."
            error={errors.filingFeeGen}
          >
            <input
              value={draft.filingFeeGen}
              onChange={(event) => {
                update("filingFeeGen", event.target.value);
              }}
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
          <Field
            label="Appeal bond (GEN)"
            hint="Attached at appeal; refunded only on a favorable outcome."
            error={errors.bondGen}
          >
            <input
              value={draft.bondGen}
              onChange={(event) => {
                update("bondGen", event.target.value);
              }}
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}

      {draft.actionType === "EXTERNAL_SOURCE_UPDATE" ? (
        <div className="space-y-4">
          <Field
            label="URL prefix"
            hint={`12 to 200 characters, https:// - prefix-matched against cited external sources.`}
            error={errors.externalPrefix}
          >
            <input
              value={draft.externalPrefix}
              onChange={(event) => {
                update("externalPrefix", event.target.value);
              }}
              placeholder="https://arweave.net/"
              spellCheck={false}
              className={cn(inputClass, "font-mono text-xs")}
            />
          </Field>
          <Field label="Effect">
            <div className="mt-2 flex gap-2">
              {[true, false].map((active) => (
                <button
                  key={String(active)}
                  type="button"
                  onClick={() => {
                    update("externalActive", active);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    draft.externalActive === active
                      ? "border-attest bg-attest text-paper"
                      : "border-line text-muted hover:border-ink/40 hover:text-ink",
                  )}
                >
                  {active === true ? "Activate" : "Deactivate"}
                </button>
              ))}
            </div>
          </Field>
        </div>
      ) : null}

      {draft.actionType === "PAUSE" || draft.actionType === "UNPAUSE" ? (
        <p className="text-sm leading-relaxed text-muted">
          {draft.actionType === "PAUSE"
            ? "A pause blocks new case filings only - already-submitted cases always continue their normal lifecycle."
            : "Lifting the pause re-enables new case filings."}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            if (validateStep() === true) {
              setStep(2);
            }
          }}
        >
          Review the proposal
        </Button>
      </div>
    </div>
  );
}
