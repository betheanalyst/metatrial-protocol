import { cn } from "@/lib/utils/cn";

/**
 * The MetaTrial mark - "the Convergence Record": three evidence dots
 * resolving through reasoning into a single sealed determination dot.
 * Deliberately free of chains, blocks, courthouses, and AI imagery.
 * Works as wordmark companion, verification mark, loading motif, and
 * case-status element; the favicon is the same glyph sealed in the
 * accent color.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-7 w-7", className)}
    >
      <circle cx="6.5" cy="8" r="2.5" fill="currentColor" opacity="0.55" />
      <circle cx="6.5" cy="16" r="2.5" fill="currentColor" opacity="0.8" />
      <circle cx="6.5" cy="24" r="2.5" fill="currentColor" opacity="0.55" />
      <path
        d="M9 8.9L20.4 15"
        stroke="currentColor"
        strokeWidth="1.7"
        opacity="0.45"
        strokeLinecap="round"
      />
      <path
        d="M9 16H19.8"
        stroke="currentColor"
        strokeWidth="1.7"
        opacity="0.6"
        strokeLinecap="round"
      />
      <path
        d="M9 23.1L20.4 17"
        stroke="currentColor"
        strokeWidth="1.7"
        opacity="0.45"
        strokeLinecap="round"
      />
      <circle cx="24" cy="16" r="4.3" fill="currentColor" />
    </svg>
  );
}

export function LogoLockup({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        MetaTrial
      </span>
    </span>
  );
}
