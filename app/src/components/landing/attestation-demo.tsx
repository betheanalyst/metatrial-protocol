import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

/**
 * Conceptual attestation artifact, explicitly labeled illustrative -
 * introduces the portable record without presenting fabricated live data.
 */
export function AttestationDemo() {
  return (
    <LandingSection id="attestation">
      <SectionHeading
        eyebrow="The attestation"
        title="One record you can take anywhere."
        lede="When a determination is final, it becomes a portable, verifiable artifact - for the parties, for platforms, for anyone."
      />

      <Reveal delay={0.1} className="mt-12">
        <figure className="mx-auto w-full max-w-md rounded-2xl border border-line bg-white px-8 py-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-attest"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink">
              MetaTrial Attestation
            </p>
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-attest"
            />
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Case #1042
            </p>
            <p className="mt-2 font-serif text-2xl tracking-tight text-ink">
              Final determination - Claimant prevails
            </p>

            <dl className="mt-6 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Issued</dt>
                <dd className="font-medium text-ink">at finalization</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Appeal rounds</dt>
                <dd className="font-medium tabular-nums text-ink">2</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Status</dt>
                <dd className="font-medium text-attest">Verified</dd>
              </div>
            </dl>
          </div>

          <figcaption className="mt-6 border-t border-line pt-4 text-xs text-muted">
            Illustrative example - not a live record
          </figcaption>
        </figure>
      </Reveal>

      <Reveal delay={0.16} className="mt-8 max-w-article">
        <p className="text-sm leading-relaxed text-muted">
          Integrating platforms can read a machine-readable ruling code and
          verify the record on-chain. MetaTrial produces credibility - what
          platforms do with an attestation stays their decision.
        </p>
      </Reveal>
    </LandingSection>
  );
}
