import { ArrowDown, ArrowRight } from "lucide-react";
import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const FLOW = [
  { label: "Case & evidence", note: "what the parties submit" },
  { label: "MetaTrial record", note: "one shared, public record" },
  { label: "GenLayer consensus", note: "independent validators agree" },
  { label: "Reasoned determination", note: "returns to the case" },
];

/** Conceptual flow only - no contract mechanics, no function names. */
export function GenLayerSection() {
  return (
    <LandingSection id="genlayer">
      <SectionHeading
        eyebrow="Where GenLayer comes in"
        title="The reasoning is performed by a network, not a black box."
        lede="MetaTrial is the experience you use. Underneath, GenLayer intelligent contracts and multi-validator consensus evaluate the submitted record."
      />

      <Reveal delay={0.1} className="mt-12">
        <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          {FLOW.map((node, index) => (
            <li key={node.label} className="flex flex-col items-center gap-2 md:flex-row md:gap-2">
              <div className="w-full rounded-xl border border-line bg-white px-5 py-4 text-center md:w-44">
                <p className="text-sm font-semibold tracking-tight text-ink">
                  {node.label}
                </p>
                <p className="mt-1 text-xs text-muted">{node.note}</p>
              </div>
              {index < FLOW.length - 1 ? (
                <span aria-hidden="true" className="text-muted md:mx-1">
                  <ArrowDown className="h-4 w-4 md:hidden" />
                  <ArrowRight className="hidden h-4 w-4 md:block" />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={0.16} className="mt-10 max-w-article">
        <p className="text-sm leading-relaxed text-muted">
          Several independent validators evaluate the same submitted record and
          must agree on the outcome. The determination returns to the case -
          and, once final, becomes an attestation anyone can verify.
        </p>
      </Reveal>
    </LandingSection>
  );
}
