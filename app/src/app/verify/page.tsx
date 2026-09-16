import type { Metadata } from "next";
import { VerifyEntry } from "@/components/verify/verify-form";

export const metadata: Metadata = {
  title: "Verify",
  description:
    "Verify a MetaTrial attestation by Case ID, Attestation ID, or external reference - public and wallet-free.",
};

export default function VerifyPage() {
  return <VerifyEntry />;
}
