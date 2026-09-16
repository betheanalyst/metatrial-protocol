"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export interface NavLinkItem {
  href: string;
  label: string;
}

export function navIsActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({ href, label }: NavLinkItem) {
  const pathname = usePathname();
  const active = navIsActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm transition-colors",
        active
          ? "border border-line bg-white text-ink"
          : "text-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}
