import type { Metadata } from "next";
import { CaseView } from "@/components/cases/case-view";

export const metadata: Metadata = {
  title: "Case",
  description:
    "A MetaTrial case record: submissions, evidence, determination, appeal history, and attestation.",
};

export default async function CasePage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;
  return <CaseView disputeId={decodeURIComponent(disputeId)} />;
}
