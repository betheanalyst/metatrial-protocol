import type { Metadata } from "next";
import Link from "next/link";
import { FileCaseForm } from "@/components/cases/file-case-form";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "File a case",
  description:
    "File a dispute on the MetaTrial public record. Reviewed and decided through GenLayer consensus.",
};

export default function NewCasePage() {
  return (
    <Container className="py-14">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm">
        <Link
          href="/cases"
          className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          ← Back to Cases
        </Link>
      </nav>
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          File a case
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Put your disagreement on the record.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Submit the case, your statement, and your evidence. The respondent is
          invited to add their side before the review begins.
        </p>
      </header>
      <div className="mt-10 max-w-3xl">
        <FileCaseForm />
      </div>
    </Container>
  );
}
