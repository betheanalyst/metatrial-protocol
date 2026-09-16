"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "./reveal";

/**
 * The signature hero motif: evidence dots converge through reasoning into
 * one sealed determination dot - the brand story told in one glyph.
 * Static for reduced-motion users.
 */
function ConvergenceMark() {
  const reduceMotion = useReducedMotion();
  const dotStyle = {
    transformBox: "fill-box" as const,
    transformOrigin: "center" as const,
  };

  if (reduceMotion) {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="h-40 w-40 text-ink sm:h-48 sm:w-48">
        <circle cx="6.5" cy="8" r="2.5" fill="currentColor" opacity="0.55" />
        <circle cx="6.5" cy="16" r="2.5" fill="currentColor" opacity="0.8" />
        <circle cx="6.5" cy="24" r="2.5" fill="currentColor" opacity="0.55" />
        <path d="M9 8.9L20.4 15" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
        <path d="M9 16H19.8" stroke="currentColor" strokeWidth="1.4" opacity="0.6" strokeLinecap="round" />
        <path d="M9 23.1L20.4 17" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
        <circle cx="24" cy="16" r="4.3" fill="#0D6E5F" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="h-40 w-40 text-ink sm:h-48 sm:w-48">
      <motion.circle cx="6.5" cy="8" r="2.5" fill="currentColor" opacity="0.55" style={dotStyle}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.45, delay: 0.1 }} />
      <motion.circle cx="6.5" cy="16" r="2.5" fill="currentColor" opacity="0.8" style={dotStyle}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.45, delay: 0.25 }} />
      <motion.circle cx="6.5" cy="24" r="2.5" fill="currentColor" opacity="0.55" style={dotStyle}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.45, delay: 0.4 }} />
      <motion.path d="M9 8.9L20.4 15" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, delay: 0.6 }} />
      <motion.path d="M9 16H19.8" stroke="currentColor" strokeWidth="1.4" opacity="0.6" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, delay: 0.7 }} />
      <motion.path d="M9 23.1L20.4 17" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, delay: 0.8 }} />
      <motion.circle cx="24" cy="16" r="4.3" fill="#0D6E5F" style={dotStyle}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 1.15 }} />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="border-b border-line">
      <Container className="grid items-center gap-12 py-20 md:grid-cols-[1.25fr_auto] md:py-28">
        <div>
          <Reveal>
            <h1 className="max-w-xl font-serif text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              When digital relationships break down, clarity matters.
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              MetaTrial turns digital disagreements into reasoned, inspectable,
              verifiable records - what was submitted, what mattered, what was
              decided, and whether it is final.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/cases">
                Explore MetaTrial
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="#determination" variant="secondary">
                See a determination
              </ButtonLink>
              <a
                href="#how-it-works"
                className="ml-1 rounded text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attest"
              >
                How it works
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-6 text-xs text-muted">
              Browsing and verification never require a wallet.
            </p>
          </Reveal>
        </div>
        <div className="flex justify-center md:justify-end">
          <ConvergenceMark />
        </div>
      </Container>
    </section>
  );
}
