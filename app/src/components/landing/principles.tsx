import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const PRINCIPLES = [
  "MetaTrial evaluates submitted evidence. It does not independently establish its authenticity, accuracy, or completeness.",
  "Parties are responsible for the truthfulness of their submissions.",
  "A determination is a reasoned assessment - never a claim of objective fact.",
  "Uncertainty and inconclusive outcomes are legitimate results, not failures.",
];

export function Principles() {
  return (
    <LandingSection id="honesty">
      <SectionHeading
        eyebrow="Epistemic honesty"
        title="Assured about process. Honest about limits."
        lede="We treat what MetaTrial does not know as a trust feature - stated plainly, not buried in fine print."
      />

      <ul className="mt-10 max-w-2xl">
        {PRINCIPLES.map((principle, index) => (
          <li key={principle} className="border-t border-line py-5 last:border-b">
            <Reveal delay={index * 0.05}>
              <p className="text-base leading-relaxed text-ink">{principle}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
