import type { Metadata } from "next";
import { MyCasesView } from "@/components/cases/my-cases-view";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "My Cases",
  description: "Your MetaTrial action center: cases needing your action, active cases, completed cases, and your attestations.",
};

export default function MyCasesPage() {
  return (
    <Container className="py-14">
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          My Cases
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Your action center.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Cases you are a party to, organized by what needs you - not a
          portfolio dashboard.
        </p>
      </header>
      <div className="mt-10">
        <MyCasesView />
      </div>
    </Container>
  );
}
