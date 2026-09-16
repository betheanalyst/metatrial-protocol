import { CaseLink, EvidenceCard } from "./case-parts";
import type { CaseDetail } from "@/lib/metatrial/types";

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

/** The Case - what is this? Parties' accounts, in their own words. */
export function CaseStatements({ detail }: { detail: CaseDetail }) {
  return (
    <NarrativeSection id="the-case" eyebrow="The case" title="The parties' accounts">
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-white px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Claimant&apos;s account
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {detail.claimantStatement}
          </p>
        </div>
        {detail.respondentStatement === "" ? (
          <div className="rounded-xl border border-dashed border-line px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Respondent&apos;s account
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              No response was submitted. Non-participation is recorded and is
              considered in the determination.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Respondent&apos;s account
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {detail.respondentStatement}
            </p>
          </div>
        )}
      </div>
    </NarrativeSection>
  );
}

/**
 * The Record - what was submitted. Integrity notes are surfaced only from
 * an issued verdict and describe hash verification, never authentication.
 */
export function CaseEvidence({
  detail,
  integrityKnown,
  claimantIntegrity,
  respondentIntegrity,
}: {
  detail: CaseDetail;
  integrityKnown: boolean;
  claimantIntegrity: boolean | null;
  respondentIntegrity: boolean | null;
}) {
  return (
    <NarrativeSection id="the-record" eyebrow="The record" title="What was submitted">
      <div className="grid gap-4 md:grid-cols-2">
        <EvidenceCard
          partyLabel="Claimant evidence"
          evidence={detail.claimantEvidence}
          integrity={integrityKnown ? claimantIntegrity : null}
        />
        <EvidenceCard
          partyLabel="Respondent evidence"
          evidence={detail.respondentEvidence}
          integrity={integrityKnown ? respondentIntegrity : null}
        />
      </div>

      {detail.precedentCitations.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Precedents cited
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {detail.precedentCitations.map((disputeId) => (
              <li key={disputeId}>
                <CaseLink disputeId={disputeId}>{disputeId}</CaseLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.externalPrecedentUrls.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            External sources cited
          </p>
          <ul className="mt-2 space-y-1">
            {detail.externalPrecedentUrls.map((url) => (
              <li key={url} className="break-all text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-attest underline-offset-4 hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Evidence listed here was submitted to the protocol and considered
        during review. MetaTrial does not independently verify the
        authenticity, accuracy, or completeness of submitted evidence.
      </p>
    </NarrativeSection>
  );
}
