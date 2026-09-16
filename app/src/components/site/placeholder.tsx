import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Honest placeholder for experiences that arrive in a later phase.
 * Never presents unavailable features as working, and never fabricates
 * protocol data.
 */
export function PhasePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Container className="flex flex-col items-center gap-5 py-28 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
        Next phase
      </p>
      <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      <ButtonLink href="/" variant="secondary">
        Back to the front door
      </ButtonLink>
    </Container>
  );
}
