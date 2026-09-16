import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const KEY_FINDINGS = [
  "The agreed deliverable was only partially provided.",
  "Payment records match the schedule for the completed portion.",
  "The claimed delay reasons are unsupported by the submitted correspondence.",
];

/**
 * The signature landing moment: a realistic determination fragment.
 * Explicitly illustrative marketing demonstration - never presented as
 * live protocol data (Foundation specification, Data & Truthfulness rules).
 */
export function DeterminationDemo() {
  return (
    <LandingSection id="determination">
      <SectionHeading
        eyebrow="The reasoning demonstration"
        title="A determination you can open and inspect."
        lede="Not a winner badge - an auditable argument: ruling, findings, reasoning, and a recommended resolution."
      />

      <Reveal delay={0.1} className="mt-12">
        <figure className="mx-auto max-w-2xl rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <span className="rounded-full bg-attest-tint px-3 py-1 text-xs font-medium text-attest-deep">
              Payment dispute
            </span>
            <span className="rounded-full border border-status-pending/40 bg-status-pending/10 px-3 py-1 text-xs font-medium text-status-pending">
              Illustrative example
            </span>
          </div>

          <div className="px-6 py-7">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Determination
            </p>
            <p className="mt-2 font-serif text-3xl tracking-tight text-ink">
              Claimant prevails
            </p>

            <dl className="mt-7 grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  Confidence
                </dt>
                <dd className="mt-1.5 text-xl font-semibold tabular-nums text-ink">
                  82%
                </dd>
                <dd className="mt-1 text-xs leading-relaxed text-muted">
                  confidence in the reasoning - not a probability of objective
                  truth
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  Primary finding
                </dt>
                <dd className="mt-1.5 text-sm font-semibold text-ink">
                  Contract breach
                </dd>
                <dd className="mt-1 text-xs leading-relaxed text-muted">
                  partial performance against the submitted agreement
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  Basis
                </dt>
                <dd className="mt-1.5 text-sm font-semibold text-ink">
                  Submitted evidence only
                </dd>
                <dd className="mt-1 text-xs leading-relaxed text-muted">
                  no independent investigation of facts
                </dd>
              </div>
            </dl>

            <div className="mt-8 border-t border-line pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                Key findings
              </p>
              <ol className="mt-3 flex flex-col gap-2.5">
                {KEY_FINDINGS.map((finding, index) => (
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

            <div className="mt-8 border-t border-line pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                Reasoning, in plain language
              </p>
              <p className="mt-3 font-serif text-base leading-relaxed text-ink">
                The agreement and payment records show an engagement that was
                started, partially delivered, and paid only in part. Weighing
                both sides on the submitted evidence, the claimant&apos;s account
                is more consistent with the record. This determination reflects
                the evidence the parties chose to submit - not an independent
                investigation.
              </p>
            </div>

            <div className="mt-8 rounded-xl bg-attest-tint px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-attest-deep">
                Recommended resolution
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-ink">
                Partial payment - 70% of the disputed milestone
              </p>
              <p className="mt-1 text-sm leading-relaxed text-attest-deep">
                Conditions: payable within 14 days of finalization.
              </p>
            </div>
          </div>
        </figure>
      </Reveal>

      <Reveal delay={0.16} className="mt-8 max-w-article">
        <p className="text-sm leading-relaxed text-muted">
          Every real MetaTrial determination carries the same structure - and
          the full chain from evidence to conclusion stays inspectable.
        </p>
      </Reveal>
    </LandingSection>
  );
}
