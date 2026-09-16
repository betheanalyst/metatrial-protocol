import type { Determination } from "@/lib/metatrial/types";
import { DeterminationBlock } from "./case-determination";
import { DecisionHistory } from "./case-history";

/** The Determination narrative section: current determination + full history. */
export function CaseDeterminationSection({
  current,
  rounds,
  loaded,
}: {
  current: Determination | null;
  rounds: Determination[];
  loaded: boolean;
}) {
  return (
    <section
      id="the-determination"
      className="scroll-mt-24 border-t border-line pt-10"
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
        The review &amp; determination
      </p>
      <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink sm:text-3xl">
        What was concluded, and why
      </h2>
      <div className="mt-6">
        {loaded === false || current === null ? (
          <p className="text-sm text-muted">Loading determination…</p>
        ) : (
          <>
            <DeterminationBlock determination={current} />
            <DecisionHistory rounds={rounds} />
          </>
        )}
      </div>
    </section>
  );
}
