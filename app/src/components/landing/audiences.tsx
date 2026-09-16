import { Briefcase, Layers, Store, Users } from "lucide-react";
import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const AUDIENCES = [
  {
    icon: Store,
    name: "Marketplaces",
    text: "Buyer and seller disputes resolved with inspectable reasoning.",
  },
  {
    icon: Briefcase,
    name: "Freelancers & clients",
    text: "Broken agreements, documented and weighed on the evidence.",
  },
  {
    icon: Layers,
    name: "Digital platforms",
    text: "Machine-readable outcomes your systems can consume.",
  },
  {
    icon: Users,
    name: "Communities",
    text: "Structured resolution without an opaque moderator verdict.",
  },
];

export function Audiences() {
  return (
    <LandingSection id="audiences">
      <SectionHeading
        eyebrow="Who it is for"
        title="Built for digital relationships."
      />

      <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {AUDIENCES.map((audience, index) => (
          <Reveal key={audience.name} delay={index * 0.05}>
            <div className="flex gap-4">
              <audience.icon
                className="mt-0.5 h-5 w-5 shrink-0 text-attest"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-base font-semibold tracking-tight text-ink">
                  {audience.name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {audience.text}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2} className="mt-10 max-w-article">
        <p className="text-sm leading-relaxed text-muted">
          MetaTrial creates the determination and the attestation. It does not
          coerce anyone - integrating platforms decide what consequences
          follow.
        </p>
      </Reveal>
    </LandingSection>
  );
}
