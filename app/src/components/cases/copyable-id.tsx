"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * A technical identifier rendered in mono with one-click copy - Case and
 * Attestation IDs are the handles users need for public verification and
 * platform integration, so they must be visible and copyable, not hidden
 * behind a tooltip.
 */
export function CopyableId({
  id,
  label,
}: {
  id: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      /* clipboard unavailable - the id remains visible for manual copy */
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {label !== undefined ? (
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
      ) : null}
      <code className="font-mono text-xs text-ink">{id}</code>
      <button
        type="button"
        onClick={() => {
          void copy();
        }}
        aria-label={`Copy ${label ?? "identifier"}`}
        title="Copy to clipboard"
        className="rounded p-0.5 text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attest"
      >
        {copied === true ? (
          <Check className="h-3.5 w-3.5 text-attest" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {copied === true ? (
        <span className="text-xs text-attest" role="status">
          Copied
        </span>
      ) : null}
    </span>
  );
}
