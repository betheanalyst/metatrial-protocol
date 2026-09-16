import type { Metadata } from "next";
import { Suspense } from "react";
import { CasesBrowser } from "@/components/cases/cases-browser";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Cases",
  description:
    "Browse MetaTrial cases by category, or look up a case by its Case ID. Public and wallet-free.",
};

export default function CasesPage() {
  return (
    <Container className="py-14">
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          Cases
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Every disagreement, on the record.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Browse cases by category, or open a case by its ID. Browsing is
          public - no wallet needed.
        </p>
        <div className="mt-6">
          <ButtonLink href="/cases/new">File a case</ButtonLink>
        </div>
      </header>
      <Suspense fallback={null}>
        <div className="mt-10">
          <CasesBrowser />
        </div>
      </Suspense>
    </Container>
  );
}
