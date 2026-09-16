"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { isExternalSourceActive } from "@/lib/genlayer/reads";

export type WhitelistState = "checking" | "active" | "inactive";

/**
 * Live governance-whitelist status for each external precedent URL, checked
 * as the URLs are entered (debounced) - the same honest highlighting the
 * evidence fields get for content-addressed prefixes. The contract remains
 * authoritative: it re-checks the whitelist at arbitration time regardless.
 */
export function useExternalSourceWhitelist(
  urls: string[],
): Map<string, WhitelistState> {
  const [states, setStates] = useState<Map<string, WhitelistState>>(new Map());
  const joined = urls.join("\n");

  useEffect(() => {
    const list = joined.split("\n").filter((entry) => entry.trim() !== "");
    if (list.length === 0) {
      setStates(new Map());
      return;
    }
    let cancelled = false;
    setStates((prev) => {
      const next = new Map(prev);
      for (const url of list) {
        if (next.has(url) === false) {
          next.set(url, "checking");
        }
      }
      for (const key of [...next.keys()]) {
        if (list.includes(key) === false) {
          next.delete(key);
        }
      }
      return next;
    });

    const timer = setTimeout(() => {
      void Promise.all(
        list.map(async (url) => {
          try {
            return [
              url,
              (await isExternalSourceActive(url)) === true ? "active" : "inactive",
            ] as const;
          } catch {
            return [url, "inactive"] as const;
          }
        }),
      ).then((entries) => {
        if (cancelled === true) {
          return;
        }
        setStates((prev) => {
          const next = new Map(prev);
          for (const [url, state] of entries) {
            next.set(url, state);
          }
          return next;
        });
      });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [joined]);

  return states;
}

export function WhitelistBadge({
  state,
}: {
  state: WhitelistState | undefined;
}) {
  if (state === undefined || state === "checking") {
    return <span className="text-xs text-muted">checking whitelist\u2026</span>;
  }
  return (
    <span
      className={cn(
        "text-xs font-medium",
        state === "active" ? "text-attest-deep" : "text-status-danger",
      )}
    >
      {state === "active" ? "Whitelisted" : "Not whitelisted"}
    </span>
  );
}
