import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const FRAGMENTS = [
  "Messages in one app",
  "Payments in another",
  "Files buried in a thread",
  "Two competing accounts of what happened",
];

export function Problem() {
  return (
    <LandingSection id="problem">
      <SectionHeading
        eyebrow="The problem"
        title="Disagreements scatter. Understanding never arrives."
        lede="A marketplace transaction, a freelance engagement, a creative collaboration - when it goes wrong, the story of what happened is everywhere and nowhere at once."
      />

      <Reveal delay={0.1} className="mt-10">
        <ul className="flex max-w-2xl flex-wrap gap-2.5" aria-label="Where disagreements live today">
          {FRAGMENTS.map((fragment) => (
            <li
              key={fragment}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm text-muted"
            >
              {fragment}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.16} className="mt-8 max-w-2xl">
        <p className="text-sm leading-relaxed text-muted">
          Until now the options were an opaque platform decision, an expensive
          legal process, or quietly absorbing the loss.
        </p>
      </Reveal>

      <Reveal delay={0.22} className="mt-10 max-w-article">
        <p className="font-serif text-2xl leading-snug tracking-tight text-ink">
          MetaTrial creates one shared record: what was submitted, what was
          considered, what was determined - and whether it is final.
        </p>
      </Reveal>
    </LandingSection>
  );
}
