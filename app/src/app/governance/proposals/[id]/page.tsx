import type { Metadata } from "next";
import Link from "next/link";
import { ProposalDetail } from "@/components/governance/proposal-detail";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Proposal",
  description: "Governance proposal detail.",
  robots: { index: false },
};

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <div className="mx-auto max-w-3xl">
        <ProposalDetail proposalId={decodeURIComponent(id)} />
      </div>
    </Container>
  );
}
