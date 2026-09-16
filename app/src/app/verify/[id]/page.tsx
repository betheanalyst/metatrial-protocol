import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { VerifyResult } from "@/components/verify/verify-result";

export const metadata: Metadata = {
  title: "Verification result",
  description:
    "Public verification result: is this record real, is the determination final, and is the attestation valid.",
};

export default async function VerifyIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <Container className="pt-8">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link
            href="/verify"
            className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            ← Back to verification
          </Link>
        </nav>
      </Container>
      <VerifyResult id={decodeURIComponent(id)} />
    </>
  );
}
