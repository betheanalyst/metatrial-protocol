import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white/60">
      <Container className="flex flex-col gap-6 py-10 text-sm text-muted">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6 text-attest" />
            <span className="font-semibold tracking-tight text-ink">
              MetaTrial
            </span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link href="/cases" className="transition-colors hover:text-ink">
              Cases
            </Link>
            <Link href="/explore" className="transition-colors hover:text-ink">
              Explore
            </Link>
            <Link href="/verify" className="transition-colors hover:text-ink">
              Verify
            </Link>
            <Link href="/governance" className="transition-colors hover:text-ink">
              Governance
            </Link>
          </nav>
        </div>

        <p className="max-w-article leading-relaxed">
          MetaTrial evaluates submitted evidence and does not independently
          verify its authenticity, accuracy, or completeness. Determinations
          are reasoned assessments, not findings of objective fact.
        </p>

        <p className="text-xs">
          Running on GenLayer Studio Devnet (chain 61997), a test network.
          {" "}&copy; {new Date().getFullYear()} MetaTrial
        </p>
      </Container>
    </footer>
  );
}
