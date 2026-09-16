import { AttestationDemo } from "@/components/landing/attestation-demo";
import { Audiences } from "@/components/landing/audiences";
import { Closing } from "@/components/landing/closing";
import { DeterminationDemo } from "@/components/landing/determination-demo";
import { GenLayerSection } from "@/components/landing/genlayer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Principles } from "@/components/landing/principles";
import { Problem } from "@/components/landing/problem";

/**
 * The front door - the full MetaTrial landing narrative:
 * welcome, problem, how it works, GenLayer, reasoning demonstration,
 * epistemic honesty, attestation, audiences, and the invitation inward.
 * Deliberately not a dashboard; deliberately not wallet-first.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <GenLayerSection />
      <DeterminationDemo />
      <Principles />
      <AttestationDemo />
      <Audiences />
      <Closing />
    </>
  );
}
