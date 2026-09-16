import type { Metadata } from "next";
import Link from "next/link";
import { ProposalCreateForm } from "@/components/governance/proposal-forms";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "New proposal",
  description: "Create a governance proposal - admin-gated.",
  robots: { index: false },
};

export default function NewProposalPage() {
  return (
    <Container className="py-14">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm">
        <Link
          href="/governance"
          className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          ← Back to Governance
        </Link>
      </nav>
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          New proposal
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Propose a protocol change.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Your creation act counts as the first approval. The remaining admins
          approve within 24 hours; the threshold triggers the timelock, and
          execution applies the change.
        </p>
      </header>
      <div className="mt-10 max-w-3xl">
        <ProposalCreateForm />
      </div>
    </Container>
  );
}
