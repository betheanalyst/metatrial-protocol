"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProtocolHealth, isExternalSourceActive } from "@/lib/genlayer/reads";
import { fileAppeal, toBigIntSafe } from "@/lib/genlayer/writes";
import { getInjectedProvider } from "@/lib/wallet/injected";
import {
  useExternalSourceWhitelist,
  WhitelistBadge,
} from "@/lib/metatrial/use-external-whitelist";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  APPEAL_GROUNDS,
  APPEAL_LIMITS,
  validateAppeal,
  type AppealDraft,
} from "@/lib/metatrial/appeal-validation";
import { formatConfidence, formatDateTime, formatGenAmount } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { TransactionFlow } from "@/components/writes/transaction-flow";
import type { Determination } from "@/lib/metatrial/types";

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

/**
 * The Challenge - a substantive, structured reconsideration, not a
 * "disagree" button. Shows the current determination as context, explains
 * the appeal budget, window, and bond economics honestly, and collects the
 * four typed grounds with per-ground guidance.
 */
export function AppealPanel({
  disputeId,
  current,
  remaining,
  appealDeadline,
}: {
  disputeId: string;
  current: Determination;
  remaining: number;
  appealDeadline: number | null;
}) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AppealDraft>({
    groundType: "",
    explanation: "",
    specific: "",
    impact: "",
    precedentIds: [],
    externalUrls: [],
  });
  const [precedentInput, setPrecedentInput] = useState("");
  const [externalInput, setExternalInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setWhitelist] = useState<Record<string, boolean>>({});
  const liveWhitelist = useExternalSourceWhitelist(draft.externalUrls);
  const [step, setStep] = useState<1 | 2>(1);

  const healthQuery = useQuery({
    queryKey: ["metatrial", "protocol-health"],
    queryFn: getProtocolHealth,
    staleTime: 15_000,
  });

  const bondWei = useMemo(() => {
    const health = healthQuery.data;
    if (health === undefined) {
      return null;
    }
    if (health.treasury_address === "") {
      return 0n;
    }
    try {
      return toBigIntSafe(health.appeal_bond_amount);
    } catch {
      return null;
    }
  }, [healthQuery.data]);

  const ground = APPEAL_GROUNDS.find((entry) => entry.type === draft.groundType);

  function update<K extends keyof AppealDraft>(key: K, value: AppealDraft[K]) {
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

  function proceedToReview(): boolean {
    const validation = validateAppeal(draft);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      return false;
    }
    const urls = draft.externalUrls;
    if (urls.length === 0) {
      setStep(2);
      return true;
    }
    void Promise.all(
      urls.map(async (url) => {
        try {
          return [url, await isExternalSourceActive(url)] as const;
        } catch {
          return [url, false] as const;
        }
      }),
    ).then((entries) => {
      const map: Record<string, boolean> = {};
      for (const [url, active] of entries) {
        map[url] = active;
      }
      setWhitelist(map);
      if (entries.some(([, active]) => active === false)) {
        setErrors((prev) => ({
          ...prev,
          externalUrls:
            "Some external sources are not on the governance whitelist and would be rejected.",
        }));
        return;
      }
      setStep(2);
    });
    return true;
  }

  if (step === 2) {
    return (
      <div className="rounded-2xl border border-line bg-white px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Review - exactly what will be recorded
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Determination being challenged
            </p>
            <p className="mt-1.5 text-sm font-medium text-ink">
              {current.rulingLabel} · {formatConfidence(current.confidence)} confidence
            </p>
            <p className="mt-1 text-xs text-muted">
              Round {current.appealRound}, issued {formatDateTime(current.renderedAt)}
            </p>
          </div>
          <div className="rounded-xl border border-line px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Your challenge
            </p>
            <p className="mt-1.5 text-sm font-medium text-ink">
              {ground?.label ?? draft.groundType}
            </p>
            <p className="mt-1 text-xs text-muted">
              Round {current.appealRound + 1} of this dispute · your remaining
              appeals after filing: {remaining - 1}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Explanation</dt>
            <dd className="text-ink">{draft.explanation}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Specific issue</dt>
            <dd className="text-ink">{draft.specific}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Impact</dt>
            <dd className="text-ink">{draft.impact}</dd>
          </div>
          {draft.precedentIds.length > 0 ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Precedents</dt>
              <dd className="font-mono text-xs text-ink">{draft.precedentIds.join(", ")}</dd>
            </div>
          ) : null}
          {draft.externalUrls.length > 0 ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">External sources</dt>
              <dd className="break-all font-mono text-xs text-ink">{draft.externalUrls.join(", ")}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 rounded-xl bg-attest-tint px-4 py-3 text-sm text-attest-deep">
          {bondWei === null ? (
            "Checking the current appeal bond\u2026"
          ) : bondWei === 0n ? (
            "No appeal bond is currently configured - filing an appeal is free."
          ) : (
            <>
              Appeal bond: exactly {formatGenAmount(bondWei)} will be attached
              ({bondWei.toString()} wei). It is refunded only if the new
              determination moves the ruling in your favor; it is forfeited
              otherwise (including inconclusive outcomes).
            </>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Filing this appeal starts a new review round of the full submitted
          record. The current determination is preserved in the decision
          history - it is never erased.
        </p>

        <TransactionFlow
          triggerLabel="Sign & file this appeal"
          run={async () => {
            if (wallet.address === null || bondWei === null) {
              return {
                status: "failed",
                primary:
                  "The appeal bond could not be confirmed right now. Refresh the page and try again.",
                raw: null,
                hash: null,
              };
            }
            let bond = bondWei;
            try {
              const fresh = await getProtocolHealth();
              bond = fresh.treasury_address === "" ? 0n : toBigIntSafe(fresh.appeal_bond_amount);
            } catch {
              /* keep the snapshot bond */
            }
            return fileAppeal({
              walletAddress: wallet.address,
              provider: getInjectedProvider(),
              disputeId,
              groundType: draft.groundType,
              explanation: draft.explanation,
              specific: draft.specific,
              impact: draft.impact,
              precedentDisputeIds: draft.precedentIds,
              externalPrecedentUrls: draft.externalUrls,
              bondWei: bond,
            });
          }}
          disabled={bondWei === null}
          disabledReason="Waiting for the current appeal bond."
          processingTitle="Re-reviewing the record"
          processingNote="Independent validators evaluate the full submitted record again, with your challenge attached. This can take a few minutes."
          successTitle="Appeal filed - the new determination is on the record."
          successNote="The decision history below now shows both rounds."
          secondaryLabel="Edit appeal"
          onSucceeded={() => {
            void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
          }}
        />

        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => {
              setStep(1);
            }}
          >
            Back to grounds
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-white px-6 py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Challenge the determination
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          An appeal is a substantive challenge, not a disagreement button. You
          have <span className="font-medium text-ink">{remaining}</span> appeal
          {remaining === 1 ? "" : "s"} remaining in this dispute
          {appealDeadline !== null
            ? ` , and the window is open until ${formatDateTime(appealDeadline)} (advisory)`
            : ""}
          .
        </p>
      </div>

      <Field label="Ground" error={errors.groundType}>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {APPEAL_GROUNDS.map((entry) => (
            <button
              key={entry.type}
              type="button"
              onClick={() => {
                update("groundType", entry.type);
              }}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors",
                draft.groundType === entry.type
                  ? "border-attest bg-attest-tint"
                  : "border-line hover:border-ink/40",
              )}
            >
              <p className="text-sm font-medium text-ink">{entry.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {entry.summary}
              </p>
            </button>
          ))}
        </div>
      </Field>

      {ground !== undefined ? (
        <div className="space-y-4">
          <Field
            label="Explanation"
            hint={`${ground.guidance.explanation} (at least ${APPEAL_LIMITS.explanationMin} characters).`}
            error={errors.explanation}
          >
            <textarea
              value={draft.explanation}
              onChange={(event) => {
                update("explanation", event.target.value);
              }}
              rows={4}
              maxLength={APPEAL_LIMITS.max}
              className={inputClass}
            />
          </Field>
          <Field
            label="The specific issue"
            hint={`${ground.guidance.specific} (at least ${APPEAL_LIMITS.specificMin} characters).`}
            error={errors.specific}
          >
            <textarea
              value={draft.specific}
              onChange={(event) => {
                update("specific", event.target.value);
              }}
              rows={3}
              maxLength={APPEAL_LIMITS.max}
              className={inputClass}
            />
          </Field>
          <Field
            label="Impact"
            hint={`${ground.guidance.impact} (at least ${APPEAL_LIMITS.impactMin} characters).`}
            error={errors.impact}
          >
            <textarea
              value={draft.impact}
              onChange={(event) => {
                update("impact", event.target.value);
              }}
              rows={3}
              maxLength={APPEAL_LIMITS.max}
              className={inputClass}
            />
          </Field>

          <Field
            label="Precedent cases (optional)"
            hint={`Up to ${APPEAL_LIMITS.precedents} finalized cases, comma-separated.`}
            error={errors.precedentIds}
          >
            <input
              value={precedentInput}
              onChange={(event) => {
                setPrecedentInput(event.target.value);
                update(
                  "precedentIds",
                  event.target.value
                    .split(/[\n,]/)
                    .map((entry) => entry.trim())
                    .filter((entry) => entry !== ""),
                );
              }}
              spellCheck={false}
              className={cn(inputClass, "font-mono text-xs")}
            />
          </Field>

          <Field
            label="External precedent sources (optional)"
            hint={`Up to ${APPEAL_LIMITS.externalUrls} whitelisted URLs, one per line.`}
            error={errors.externalUrls}
          >
            <textarea
              value={externalInput}
              onChange={(event) => {
                setExternalInput(event.target.value);
                update(
                  "externalUrls",
                  event.target.value
                    .split("\n")
                    .map((entry) => entry.trim())
                    .filter((entry) => entry !== ""),
                );
              }}
              rows={2}
              spellCheck={false}
              className={cn(inputClass, "font-mono text-xs")}
            />
            <ul className="mt-2 space-y-1">
              {draft.externalUrls.map((url) => (
                <li key={url} className="flex flex-wrap items-center gap-2 text-xs">
                  <WhitelistBadge state={liveWhitelist.get(url)} />
                  <span className="break-all font-mono text-muted">{url}</span>
                </li>
              ))}
            </ul>
          </Field>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            proceedToReview();
          }}
        >
          Review the appeal
        </Button>
      </div>
    </div>
  );
}
