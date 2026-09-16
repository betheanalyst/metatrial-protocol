import type { Metadata } from "next";
import { GovernanceView } from "@/components/governance/governance-view";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Governance",
  description: "MetaTrial protocol administration - admin-gated.",
  robots: { index: false },
};

export default function GovernancePage() {
  return (
    <Container className="py-14">
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          Governance
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Protocol administration.
        </h1>
      </header>
      <div className="mt-10">
        <GovernanceView />
      </div>
    </Container>
  );
}
