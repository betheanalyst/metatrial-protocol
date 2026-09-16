"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, ExternalLink, LoaderCircle } from "lucide-react";
import type { WriteOutcome } from "@/lib/genlayer/writes";
import { explorerTransactionUrl } from "@/lib/wallet/tx-tracker";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

/**
 * The MetaTrial transaction lifecycle: Review -> Confirm -> Process ->
 * Outcome -> Next action. Never stops at "transaction successful" - every
 * phase is translated into what is happening to the case or record, and
 * uncertainty is shown honestly rather than claimed as failure.
 */
export function TransactionFlow({
  triggerLabel,
  review,
  run,
  disabled = false,
  disabledReason,
  processingTitle,
  processingNote,
  successTitle,
  successNote,
  onSucceeded,
  secondaryLabel = "Try again",
}: {
  triggerLabel: string;
  review?: React.ReactNode;
  run: () => Promise<WriteOutcome>;
  disabled?: boolean;
  disabledReason?: string;
  processingTitle: string;
  processingNote?: string;
  successTitle: string;
  successNote?: React.ReactNode;
  onSucceeded?: () => void;
  secondaryLabel?: string;
}) {
  const [phase, setPhase] = useState<
    "review" | "confirming" | "processing" | "success" | "failed" | "uncertain"
  >("review");
  const [outcome, setOutcome] = useState<WriteOutcome | null>(null);

  async function execute() {
    setPhase("confirming");
    setOutcome(null);
    const pending = run();
    setPhase("processing");
    const result = await pending;
    setOutcome(result);
    if (result.status === "success") {
      setPhase("success");
      onSucceeded?.();
    } else if (result.status === "uncertain") {
      setPhase("uncertain");
    } else {
      setPhase("failed");
    }
  }

  if (phase === "processing" || phase === "confirming") {
    return (
      <div
        className="rounded-xl border border-attest/30 bg-attest-tint px-5 py-5"
        role="status"
        aria-live="polite"
      >
        <p className="flex items-center gap-2.5 text-sm font-medium text-attest-deep">
          <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          {phase === "confirming"
            ? "Confirm in your wallet to continue\u2026"
            : processingTitle}
        </p>
        {processingNote !== undefined && phase === "processing" ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {processingNote}
          </p>
        ) : null}
        {outcome?.hash !== undefined && outcome.hash !== null ? (
          <a
            href={explorerTransactionUrl(outcome.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-attest underline-offset-4 hover:underline"
          >
            Follow the transaction in the explorer
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div
        className="rounded-xl border border-attest/40 bg-attest-tint px-5 py-5"
        role="status"
        aria-live="polite"
      >
        <p className="flex items-center gap-2.5 text-sm font-medium text-attest-deep">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {successTitle}
        </p>
        {successNote !== undefined ? (
          <div className="mt-2 text-sm leading-relaxed text-ink">{successNote}</div>
        ) : null}
        {outcome?.hash !== undefined && outcome.hash !== null ? (
          <a
            href={explorerTransactionUrl(outcome.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-attest underline-offset-4 hover:underline"
          >
            View the transaction
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  if (phase === "failed" || phase === "uncertain") {
    return (
      <div
        className={cn(
          "rounded-xl border px-5 py-5",
          phase === "uncertain"
            ? "border-status-pending/40 bg-status-pending/10"
            : "border-status-danger/40 bg-status-danger/10",
        )}
        role="alert"
        aria-live="polite"
      >
        <p
          className={cn(
            "flex items-center gap-2.5 text-sm font-medium",
            phase === "uncertain" ? "text-status-pending" : "text-status-danger",
          )}
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {outcome?.primary ?? "Something went wrong."}
        </p>
        {outcome?.raw !== undefined && outcome.raw !== null ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">
              Technical details
            </summary>
            <p className="mt-1 break-words font-mono text-xs text-muted">
              {outcome.raw}
            </p>
          </details>
        ) : null}
        {outcome?.hash !== undefined && outcome.hash !== null ? (
          <a
            href={explorerTransactionUrl(outcome.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink underline-offset-4 hover:underline"
          >
            View the transaction
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
        {phase === "failed" ? (
          <div className="mt-4">
            <Button
              variant="secondary"
              className="px-4 py-2 text-xs"
              onClick={() => {
                setPhase("review");
                setOutcome(null);
              }}
            >
              {secondaryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {review !== undefined ? (
        <div className="rounded-xl border border-line bg-white px-5 py-4">{review}</div>
      ) : null}
      <div className="mt-4">
        <Button
          onClick={() => {
            void execute();
          }}
          disabled={disabled}
          title={disabled === true ? disabledReason : undefined}
        >
          {triggerLabel}
        </Button>
        {disabled === true && disabledReason !== undefined ? (
          <p className="mt-2 text-xs text-muted">{disabledReason}</p>
        ) : null}
      </div>
    </div>
  );
}
