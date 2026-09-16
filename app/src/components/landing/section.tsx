import { cn } from "@/lib/utils/cn";
import { Container } from "@/components/ui/container";
import { Reveal } from "./reveal";

/** Consistent editorial section rhythm across the landing narrative. */
export function LandingSection({
  id,
  bordered = true,
  className,
  children,
}: {
  id?: string;
  bordered?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(bordered && "border-b border-line", "py-20 sm:py-24", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <Reveal className="max-w-article">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 text-base leading-relaxed text-muted">{lede}</p>
      ) : null}
    </Reveal>
  );
}
