import type { Metadata } from "next";
import { ExploreView } from "@/components/explore/explore-view";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Discover MetaTrial cases and determinations by category - editorial discovery, not analytics.",
};

export default function ExplorePage() {
  return (
    <Container className="py-14">
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          Explore
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Discovery, not analytics.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Browse the record by category, follow the newest cases, or open a
          specific one. Everything here is public - no wallet needed.
        </p>
      </header>
      <div className="mt-12">
        <ExploreView />
      </div>
    </Container>
  );
}
