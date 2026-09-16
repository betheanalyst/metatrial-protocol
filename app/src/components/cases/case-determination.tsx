import { formatConfidence, formatDateTime } from "@/lib/utils/format";
import type { Determination } from "@/lib/metatrial/types";
import { LabeledField } from "./case-parts";

/**
 * The Determination - the visual centerpiece of the case page.
 * Mirrors the landing reasoning demonstration, driven by real protocol data.
 */
export function DeterminationBlock({ determination }: { determination: Determination }) {
  return (
    <article className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-attest-tint px-3 py-1 text-xs font-medium text-attest-deep">
            Round {determination.appealRound}
            {determination.retryCount > 0 ? " · retried" : ""}
          </span>
          {determination.isCurrent ? (
            <span className="rounded-full border border-attest bg-attest px-3 py-1 text-xs font-medium text-paper">
              {""}{"Current"}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted">
          Issued {formatDateTime(determination.renderedAt)}
        </span>
      </div>

      <div className="px-6 py-7">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Determination
        </p>
        <p className="mt-2 font-serif text-3xl tracking-tight text-ink">
          {determination.rulingLabel}
        </p>

        <dl className="mt-7 grid gap-6 sm:grid-cols-3">
          <LabeledField label="Confidence">
            <span className="text-xl font-semibold tabular-nums">
              {formatConfidence(determination.confidence)}
            </span>
            <span className="mt-1 block text-xs text-muted">
              confidence in the reasoning - not a probability of objective truth
            </span>
          </LabeledField>
          <LabeledField label="Primary finding">
            {determination.primaryFindingLabel}
          </LabeledField>
          <LabeledField label="Evidence quality">
            <span>
              Claimant: {determination.claimantEvidenceQuality} · Respondent:{""}
              {determination.respondentEvidenceQuality}
            </span>
          </LabeledField>
        </dl>

        {determination.keyFindings.length > 0 ? (
          <div className="mt-8 border-t border-line pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Key findings
            </p>
            <ol className="mt-3 flex flex-col gap-2.5">
              {determination.keyFindings.map((finding, index) => (
                <li key={finding} className="flex gap-3 text-sm text-ink">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-medium tabular-nums text-attest"
                  >
                    {index + 1}.
                  </span>
                  <span className="leading-relaxed">{finding}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {determination.reasoningSummary !== "" ? (
          <div className="mt-8 border-t border-line pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Reasoning, in plain language
            </p>
            <p className="mt-3 font-serif text-base leading-relaxed text-ink">
              {determination.reasoningSummary}
            </p>
          </div>
        ) : null}

        <div className="mt-8 rounded-xl bg-attest-tint px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-attest-deep">
            Recommended resolution
          </p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-ink">
            {determination.resolution.remedyLabel}
            {determination.resolution.percentage !== null
              ? ` - ${determination.resolution.percentage}%`
              : ""}
          </p>
          {determination.resolution.detail !== "" ? (
            <p className="mt-1 text-sm leading-relaxed text-ink">
              {determination.resolution.detail}
            </p>
          ) : null}
          {determination.resolution.conditions !== "" ? (
            <p className="mt-1 text-sm leading-relaxed text-attest-deep">
              Conditions: {determination.resolution.conditions}
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          {determination.basisOfDetermination}
        </p>

        {determination.precedentsConsidered.length > 0 ||
        determination.externalSources.length > 0 ? (
          <div className="mt-6 border-t border-line pt-5">
            {determination.precedentsConsidered.length > 0 ? (
              <p className="text-xs text-muted">
                Precedents considered:{""}
                {determination.precedentsConsidered
                  .map((entry) => entry.disputeId)
                  .join(", ")}
              </p>
            ) : null}
            {determination.externalSources.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {determination.externalSources.map((source) => (
                  <li
                    key={source.url}
                    className="break-all text-xs text-muted"
                  >
                    {source.url}
                    {" "}
                    -{""}
                    {source.fetchOk
                      ? "fetched at arbitration"
                      : "fetch failed at arbitration"}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
