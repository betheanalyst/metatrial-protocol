import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "quiet";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium " +
  "transition-colors focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-attest disabled:cursor-default disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-attest text-paper hover:bg-attest-deep",
  secondary: "border border-ink/25 bg-white text-ink hover:border-ink/60",
  quiet: "text-muted hover:text-ink",
};

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], "px-5 py-2.5", className)}
    >
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(base, variants[variant], "px-5 py-2.5", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
