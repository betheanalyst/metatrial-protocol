import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { CopyableId } from "./copyable-id";
import { formatDateTime } from "@/lib/utils/format";
import { shortenAddress } from "@/lib/utils/format";
import type { AppealEntry, Attestation, Determination } from "@/lib/metatrial/types";

function NarrativeSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * The Challenge - full appeal history. Earlier rounds are never erased or
 * collapsed into the latest verdict (Experience Blueprint, handoff rules).
 */
export function CaseAppeals({
  appeals,
  loaded,
}: {
  appeals: AppealEntry[];
  loaded: boolean;
}) {
  return (
    <NarrativeSection id="the-challenge" eyebrow="The challenge" title="Appeal history">
      {loaded === false ? (
        <p className="text-sm text-muted">Loading appeal history…</p>
      ) : appeals.length === 0 ? (
        <p className="text-sm text-muted">No appeals have been filed.</p>
      ) : (
        <ol className="space-y-4">
          {appeals.map((appeal) => (
            <li
              key={`${appeal.roundNumber}-${appeal.appellant}`}
              className="rounded-xl border border-line bg-white px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-attest-tint px-2.5 py-0.5 text-xs font-medium text-attest-deep">
                  Round {appeal.roundNumber} · {appeal.groundLabel}
                </span>
                <span className="text-xs text-muted">
                  Filed {formatDateTime(appeal.filedAt)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Appellant{" "}
                <span className="font-mono text-ink">
                  {shortenAddress(appeal.appellant)}
                </span>
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
                    Explanation
                  </dt>
                  <dd className="mt-0.5 leading-relaxed text-ink">
                    {appeal.explanation}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
                    Specific issue
                  </dt>
                  <dd className="mt-0.5 leading-relaxed text-ink">
                    {appeal.specific}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
                    Impact
                  </dt>
                  <dd className="mt-0.5 leading-relaxed text-ink">
                    {appeal.impact}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </NarrativeSection>
  );
}

/**
 * Decision history - every round preserved, current round unmistakable.
 * Historic rounds are collapsed but expandable (progressive disclosure).
 */
export function DecisionHistory({ rounds }: { rounds: Determination[] }) {
  if (rounds.length === 0) {
    return null;
  }
  return (
    <div className="mt-8 border-t border-line pt-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Decision history - every round preserved
      </p>
      <ol className="mt-3 space-y-2">
        {rounds.map((round, index) => (
          <li key={`${round.renderedAt}-${index}`}>
            <details
              className="group rounded-xl border border-line bg-white px-5 py-4"
              open={round.isCurrent}
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-3">
                  <span className="font-medium text-ink">
                    Round {round.appealRound}
                  </span>
                  <span className="text-muted">{round.rulingLabel}</span>
                  {round.isCurrent ? (
                    <span className="rounded-full border border-attest bg-attest px-2 py-0.5 text-xs font-medium text-paper">
                      Current
                    </span>
                  ) : (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                      Superseded
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {formatDateTime(round.renderedAt)}
                </span>
              </summary>
              <div className="mt-3 border-t border-line pt-3 text-sm text-ink">
                <p>
                  Primary finding: {round.primaryFindingLabel} · Confidence:{""}
                  {round.confidence}%
                </p>
                {round.reasoningSummary !== "" ? (
                  <p className="mt-2 leading-relaxed text-muted">
                    {round.reasoningSummary}
                  </p>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The Final Record + The Attestation. Core finality and registry
 * verification are separate concerns; public verification lives at /verify.
 */
export function CaseFinalRecord({
  isFinalized,
  finalizedAt,
  attestation,
  attestationLoaded,
  registryState,
  registryValid,
}: {
  isFinalized: boolean;
  finalizedAt: number | null;
  attestation: Attestation | undefined;
  attestationLoaded: boolean;
  registryState: { status: string; mirrorFailed: boolean } | null;
  registryValid: boolean | null;
}) {
  return (
    <NarrativeSection
      id="the-final-record"
      eyebrow="The final record"
      title={isFinalized ? "Final determination" : "Not yet final"}
    >
      {isFinalized === false ? (
        <p className="max-w-article text-sm leading-relaxed text-muted">
          This determination is not final yet. Once the appeal window closes -
          or the appeal budget is exhausted - the case can be finalized, and
          the record becomes sealed and attested.
        </p>
      ) : (
        <div>
          <p className="max-w-article text-sm leading-relaxed text-ink">
            This determination is final{finalizedAt !== null ? ` (finalized ${formatDateTime(finalizedAt)})` : ""}.
            The record is sealed and an attestation has been issued.
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-white px-6 py-6 sm:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-ink">
              MetaTrial Attestation
            </p>
            {attestationLoaded === false ? (
              <p className="mt-5 text-center text-sm text-muted">
                Loading attestation…
              </p>
            ) : attestation === undefined ? (
              <p className="mt-5 text-center text-sm text-muted">
                The attestation could not be read right now.
              </p>
            ) : (
              <>
                <dl className="mt-5 flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">Attestation ID</dt>
                    <dd>
                      <CopyableId id={attestation.id} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">Final determination</dt>
                    <dd className="font-medium text-ink">{attestation.rulingLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">Issued</dt>
                    <dd className="text-ink">{formatDateTime(attestation.issuedAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">Appeal rounds</dt>
                    <dd className="tabular-nums text-ink">{attestation.appealRoundsUsed}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">Respondent participated</dt>
                    <dd className="text-ink">{attestation.respondentParticipated ? "Yes" : "No"}</dd>
                  </div>
                  {attestation.externalRef !== "" ? (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted">External reference</dt>
                      <dd className="max-w-[60%] truncate font-mono text-xs text-ink" title={attestation.externalRef}>
                        {attestation.externalRef}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                  {attestation.basisOfDetermination}
                </p>
              </>
            )}
            {registryState !== null ? (
            <div
              className={cn(
                "mt-5 rounded-xl border px-4 py-3 text-xs leading-relaxed",
                registryState.status === "INDEXED"
                  ? "border-attest/40 bg-attest-tint text-attest-deep"
                  : "border-status-pending/40 bg-status-pending/10 text-status-pending",
              )}
            >
              {registryState.status === "INDEXED" ? (
                <>Verified &amp; indexed in the public attestation registry.</>
              ) : (
                <>
                  Final determination recorded - the public verification index
                  is still synchronizing.
                  {registryState.mirrorFailed
                    ? " The automatic update did not complete; any wallet can retry it from the verification page."
                    : ""}
                </>
              )}
            </div>
          ) : null}
          {registryValid !== null ? (
            <p className={cn("mt-3 text-center text-xs", registryValid === true ? "text-attest-deep" : "text-status-danger")}>
              {registryValid === true
                ? "Attestation valid (registry-checked, revocation-aware)."
                : "Attestation revoked by the registry - see the verification page for the reason."}
            </p>
          ) : null}
          <p className="mt-5 text-center text-xs text-muted">
              Anyone can verify this record publicly -{" "}
              <Link
                href="/verify"
                className="text-attest underline-offset-4 hover:underline"
              >
                public verification
              </Link>{" "}
              requires no wallet.
            </p>
          </div>
        </div>
      )}
    </NarrativeSection>
  );
}
