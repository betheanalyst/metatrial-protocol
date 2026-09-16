"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getInjectedProvider } from "@/lib/wallet/injected";
import { useWallet } from "@/lib/wallet/wallet-context";
import { respondToDispute } from "@/lib/genlayer/writes";
import type { CaseDetail } from "@/lib/metatrial/types";
import { cn } from "@/lib/utils/cn";
import { TransactionFlow } from "@/components/writes/transaction-flow";

const LIMITS = {
  statement: 3000,
  inline: 6000,
  hash: 128,
  summary: 1000,
  summaryMin: 50,
};

type EvidenceType = "INLINE_TEXT" | "URL" | "FILE_REFERENCE";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-attest focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      {children}
      {hint !== undefined ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * The respondent's opportunity to be heard (Experience Blueprint §9).
 * Participation is optional at the protocol level; the UI makes the
 * opportunity clear and explains that non-participation is recorded.
 */
export function RespondPanel({ detail }: { detail: CaseDetail }) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [statement, setStatement] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType | null>(null);
  const [evidenceContent, setEvidenceContent] = useState("");
  const [evidenceHash, setEvidenceHash] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [consentParticipation, setConsentParticipation] = useState(false);
  const [consentAppeal, setConsentAppeal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const canConsentParticipation = detail.participation.requestedSkip;
  const canConsentAppeal = detail.appealWaiver.requested;

  function validate(): boolean {
    if (statement.length > LIMITS.statement) {
      setLocalError(`The statement is limited to ${LIMITS.statement} characters.`);
      return false;
    }
    if (evidenceType === null) {
      setLocalError(null);
      return true;
    }
    if (evidenceType === "INLINE_TEXT") {
      if (evidenceContent.trim() === "" || evidenceContent.length > LIMITS.inline) {
        setLocalError(`Inline evidence is required and limited to ${LIMITS.inline} characters.`);
        return false;
      }
      if (evidenceSummary.length > LIMITS.summary) {
        setLocalError(`The summary is limited to ${LIMITS.summary} characters.`);
        return false;
      }
    } else {
      if (evidenceContent.trim() === "" || evidenceHash.trim() === "") {
        setLocalError(
          "Content-addressed evidence needs both the URL and its content hash.",
        );
        return false;
      }
      if (evidenceHash.length > LIMITS.hash) {
        setLocalError(`The content hash is limited to ${LIMITS.hash} characters.`);
        return false;
      }
      if (evidenceType === "FILE_REFERENCE") {
        if (
          evidenceSummary.trim().length < LIMITS.summaryMin ||
          evidenceSummary.length > LIMITS.summary
        ) {
          setLocalError(
            `A summary of ${LIMITS.summaryMin} to ${LIMITS.summary} characters is required for file references.`,
          );
          return false;
        }
      }
    }
    setLocalError(null);
    return true;
  }

  const hasEvidence = evidenceType !== null;
  const hasSomething = statement.trim() !== "" || hasEvidence;

  return (
    <TransactionFlow
      triggerLabel="Sign & submit response"
      disabled={hasSomething === false}
      review={
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-ink">
            This case is waiting for your side. Responding is optional - but if
            you stay silent, your non-participation is recorded and considered
            in the determination.
          </p>

          <Field
            label="Your statement"
            hint={`What happened from your perspective (optional, up to ${LIMITS.statement} characters).`}
          >
            <textarea
              value={statement}
              onChange={(event) => {
                setStatement(event.target.value);
              }}
              rows={5}
              maxLength={LIMITS.statement}
              className={inputClass}
            />
          </Field>

          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Your evidence (optional)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  [null, "No evidence"],
                  ["INLINE_TEXT", "Inline text"],
                  ["URL", "Content-addressed URL"],
                  ["FILE_REFERENCE", "File reference"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setEvidenceType(value);
                  }}
                  className={
                    evidenceType === value
                      ? "rounded-full border border-attest bg-attest px-3 py-1.5 text-sm text-paper"
                      : "rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-ink/40 hover:text-ink"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {evidenceType === "INLINE_TEXT" ? (
              <textarea
                value={evidenceContent}
                onChange={(event) => {
                  setEvidenceContent(event.target.value);
                }}
                rows={4}
                maxLength={LIMITS.inline}
                placeholder="Your evidence, up to 6,000 characters."
                className={inputClass}
              />
            ) : null}
            {evidenceType === "URL" || evidenceType === "FILE_REFERENCE" ? (
              <input
                value={evidenceContent}
                onChange={(event) => {
                  setEvidenceContent(event.target.value);
                }}
                placeholder="ipfs://\u2026 or https://arweave.net/\u2026"
                spellCheck={false}
                className={cn(inputClass, "font-mono text-xs")}
              />
            ) : null}
            {evidenceType === "URL" || evidenceType === "FILE_REFERENCE" ? (
              <input
                value={evidenceHash}
                onChange={(event) => {
                  setEvidenceHash(event.target.value);
                }}
                placeholder="Content hash (CID or Arweave TX ID)"
                spellCheck={false}
                className={cn(inputClass, "font-mono text-xs")}
              />
            ) : null}
            {evidenceType !== null ? (
              evidenceType === "FILE_REFERENCE" ? (
                <>
                  <Field
                    label="Summary (required for file references)"
                    hint={`${LIMITS.summaryMin} to ${LIMITS.summary} characters - describes the referenced file.`}
                  >
                    <textarea
                      value={evidenceSummary}
                      onChange={(event) => {
                        setEvidenceSummary(event.target.value);
                      }}
                      rows={3}
                      maxLength={LIMITS.summary}
                      className={inputClass}
                    />
                  </Field>
                </>
              ) : (
                <Field
                  label="Evidence summary (optional)"
                  hint={`A short description of what this evidence shows (${LIMITS.summary} characters max).`}
                >
                  <input
                    value={evidenceSummary}
                    onChange={(event) => {
                      setEvidenceSummary(event.target.value);
                    }}
                    maxLength={LIMITS.summary}
                    className={inputClass}
                  />
                </Field>
              )
            ) : null}
          </fieldset>

          {canConsentParticipation || canConsentAppeal ? (
            <div className="space-y-3 rounded-xl border border-line px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                The claimant requested skips - your explicit consent decides
              </p>
              {canConsentParticipation ? (
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={consentParticipation}
                    onChange={(event) => {
                      setConsentParticipation(event.target.checked);
                    }}
                    className="mt-1"
                  />
                  <span>
                    Agree to skip the participation window (closes it
                    immediately). Declining keeps your full window.
                  </span>
                </label>
              ) : null}
              {canConsentAppeal ? (
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={consentAppeal}
                    onChange={(event) => {
                      setConsentAppeal(event.target.checked);
                    }}
                    className="mt-1"
                  />
                  <span>
                    Agree to skip appeals for this case. This cannot be undone
                    later - silence keeps your full appeal rights.
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}

          {localError !== null ? (
            <p className="text-xs text-status-danger" role="alert">
              {localError}
            </p>
          ) : null}
        </div>
      }
      run={async () => {
        if (validate() === false || wallet.address === null) {
          return {
            status: "failed",
            primary:
              localError ?? "The response could not be validated. Review it and try again.",
            raw: null,
            hash: null,
          };
        }
        const outcome = await respondToDispute({
          walletAddress: wallet.address,
          provider: getInjectedProvider(),
          disputeId: detail.id,
          statement,
          evidenceType: evidenceType ?? "",
          evidenceContent:
            evidenceType === null ? "" : evidenceContent,
          evidenceHash: evidenceType === null ? "" : evidenceHash,
          evidenceSummary: evidenceType === null ? "" : evidenceSummary,
          consentSkipParticipation: consentParticipation,
          consentSkipAppeal: consentAppeal,
        });
        return outcome;
      }}
      processingTitle="Adding your side to the record"
      processingNote="Your response is going through consensus and will appear on the case as soon as it is decided."
      successTitle="Your response is on the record."
      successNote="The claimant can now start the review - or wait for the window to close."
      onSucceeded={() => {
        void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
      }}
      secondaryLabel="Edit response"
    />
  );
}
