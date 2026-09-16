"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LandingSection, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const STEPS = [
  {
    n: "01",
    title: "Submit",
    text: "The dispute and its evidence enter the record.",
  },
  {
    n: "02",
    title: "Participate",
    text: "The respondent is invited to add their side. Silence is recorded too.",
  },
  {
    n: "03",
    title: "Review",
    text: "The submitted record is evaluated through independent consensus, not a single opaque judge.",
  },
  {
    n: "04",
    title: "Determine",
    text: "A structured determination emerges: ruling, findings, reasoning, and a recommended resolution.",
  },
  {
    n: "05",
    title: "Appeal",
    text: "Substantive challenges can reopen review. Earlier decisions are preserved, never erased.",
  },
  {
    n: "06",
    title: "Attest",
    text: "Once final, the determination becomes a portable record anyone can verify.",
  },
];

/**
 * One continuous narrative, not six feature cards: a single record line
 * accumulates down the page as the story progresses.
 */
export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <LandingSection id="how-it-works">
      <SectionHeading
        eyebrow="How it works"
        title="One disagreement becomes one record."
        lede="Six moments, one continuous story - the record grows, is weighed, and resolves."
      />

      <div className="relative mt-12 max-w-2xl">
        <div
          aria-hidden="true"
          className="absolute bottom-2 left-[7px] top-2 w-px bg-line"
        />
        {reduceMotion ? null : (
          <motion.div
            aria-hidden="true"
            className="absolute bottom-2 left-[7px] top-2 w-px origin-top bg-attest"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        )}

        <ol className="flex flex-col gap-8">
          {STEPS.map((step, index) => (
            <li key={step.n}>
              <Reveal delay={index * 0.05}>
                <div className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-attest bg-paper"
                  />
                  <div>
                    <p className="text-xs font-medium tabular-nums tracking-[0.16em] text-attest">
                      {step.n}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                      {step.text}
                    </p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </LandingSection>
  );
}
