import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LandingSection } from "./section";
import { Reveal } from "./reveal";

export function Closing() {
  return (
    <LandingSection id="closing" bordered={false} className="pb-28">
      <Reveal className="mx-auto max-w-article text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          Explore the real thing
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Bring the disagreement. Follow the reasoning. Verify the record.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Live cases, real determinations, and public verification - no wallet
          needed to look.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/cases">
            Explore cases
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/verify" variant="secondary">
            Verify an attestation
          </ButtonLink>
        </div>
      </Reveal>
    </LandingSection>
  );
}
