"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Wallet, X } from "lucide-react";
import { useWallet } from "@/lib/wallet/wallet-context";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { LogoLockup } from "./logo";
import { NavLink, type NavLinkItem } from "./nav-links";

function shortenAddress(address: string): string {
  return address.slice(0, 6) + "\u2026" + address.slice(-4);
}

/** Quiet wallet control: connection state, network state, no fanfare. */
function WalletControl() {
  const wallet = useWallet();

  if (wallet.hasProvider === false) {
    return (
      <span
        className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex"
        title="No injected wallet detected in this browser"
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
        No wallet
      </span>
    );
  }

  if (wallet.status === "connected") {
    return (
      <span className="flex items-center gap-2">
        {wallet.onStudioDevnet ? (
          <span className="hidden rounded-full bg-attest-tint px-2.5 py-1 text-[11px] font-medium text-attest-deep sm:inline-flex">
            Studio Devnet
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              void wallet.switchNetwork();
            }}
            className="rounded-full border border-status-pending/40 bg-status-pending/10 px-2.5 py-1 text-[11px] font-medium text-status-pending transition-colors hover:bg-status-pending/20"
          >
            Switch to Studio Devnet
          </button>
        )}
        <button
          type="button"
          onClick={wallet.disconnect}
          title="Disconnect wallet (local state only)"
          aria-label="Disconnect wallet"
          className="rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:border-ink/40"
        >
          {shortenAddress(wallet.address ?? "")}
        </button>
      </span>
    );
  }

  return (
    <Button
      variant="primary"
      className="px-4 py-2 text-xs"
      disabled={wallet.status === "connecting"}
      onClick={() => {
        void wallet.connect();
      }}
    >
      {wallet.status === "connecting" ? "Connecting\u2026" : "Connect"}
    </Button>
  );
}

export function SiteHeader() {
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  const links: NavLinkItem[] = [
    { href: "/cases", label: "Cases" },
    { href: "/explore", label: "Explore" },
    { href: "/verify", label: "Verify" },
  ];
  if (wallet.status === "connected") {
    links.push({ href: "/my-cases", label: "My Cases" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-[2px]">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="MetaTrial home"
          className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-attest"
        >
          <LogoLockup markClassName="h-7 w-7 text-ink" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <WalletControl />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => {
              setMenuOpen(menuOpen === false);
            }}
            className="rounded-full p-2 text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attest md:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>

      {menuOpen ? (
        <nav
          aria-label="Mobile"
          className={cn("border-t border-line bg-paper md:hidden")}
        >
          <Container className="flex flex-col gap-1 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => {
                  setMenuOpen(false);
                }}
                className="rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
