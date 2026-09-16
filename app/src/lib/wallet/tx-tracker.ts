/**
 * Persistent transaction tracking - a transaction hash alone is not proof of
 * success (foundation specification). Hashes are recorded the moment they
 * exist and survive page reloads; consensus outcome is confirmed separately
 * through the SDK before any status is marked final.
 */

export type TrackedTxStatus = "pending" | "success" | "failed" | "uncertain";

export interface TrackedTx {
  hash: string;
  label: string;
  status: TrackedTxStatus;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "metatrial.transactions.v1";
const MAX_TRACKED = 40;

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

export function getTrackedTransactions(): TrackedTx[] {
  if (isBrowser() === false) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedTx[]) : [];
  } catch {
    return [];
  }
}

function write(transactions: TrackedTx[]): void {
  if (isBrowser() === false) {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(transactions.slice(0, MAX_TRACKED)),
    );
  } catch {
    /* storage unavailable - tracking is best-effort */
  }
}

/** Record a hash the instant it exists, before any waiting happens. */
export function trackTransaction(hash: string, label: string): void {
  if (hash === "") {
    return;
  }
  const now = Date.now();
  const existing = getTrackedTransactions().filter(
    (entry) => entry.hash !== hash,
  );
  write([
    { hash, label, status: "pending", createdAt: now, updatedAt: now },
    ...existing,
  ]);
}

export function updateTransaction(hash: string, status: TrackedTxStatus): void {
  if (hash === "") {
    return;
  }
  write(
    getTrackedTransactions().map((entry) =>
      entry.hash === hash
        ? { ...entry, status, updatedAt: Date.now() }
        : entry,
    ),
  );
}

export function explorerTransactionUrl(hash: string): string {
  const base = "https://explorer-studio-dev.genlayer.com";
  return `${base}/tx/${hash}`;
}
