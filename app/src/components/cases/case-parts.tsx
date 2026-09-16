import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, shortenAddress } from "@/lib/utils/format";
import type { EvidenceView } from "@/lib/metatrial/types";

export interface StatusPillState {
  label: string;
  description: string;
  tone: "pending" | "active" | "final" | "muted";
}

const TONE_CLASSES: Record<StatusPillState["tone"], string> = {
  pending: "border-status-pending/40 bg-status-pending/10 text-status-pending",
  active: "border-attest/40 bg-attest-tint text-attest-deep",
  final: "border-attest bg-attest text-paper",
  muted: "border-line bg-white text-muted",
};

const TONE_DOT_CLASSES: Record<StatusPillState["tone"], string> = {
  pending: "bg-status-pending",
  active: "bg-attest",
  final: "bg-paper",
  muted: "bg-muted",
};

/** State is never color-only: every pill carries a dot, a label, and a title. */
export function StatusPill({ status }: { status: StatusPillState }) {
  return (
    <span
      title={status.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[status.tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT_CLASSES[status.tone])}
      />
      {status.label}
    </span>
  );
}

export function AddressChip({
  role,
  address,
}: {
  role: string;
  address: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
        {role}
      </span>
      <span
        title={address}
        className="font-mono text-xs text-ink"
      >
        {shortenAddress(address)}
      </span>
    </span>
  );
}

export function LabeledField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

export function CaseIdChip({
  disputeId,
  caseNumber,
}: {
  disputeId: string;
  caseNumber: string | null;
}) {
  return (
    <span
      title={disputeId}
      className="font-mono text-xs text-muted"
    >
      {caseNumber === null ? disputeId : `Case #${caseNumber}`}
    </span>
  );
}

/**
 * One evidence submission. The contract view does not expose respondent
 * evidence content or file summaries - stated plainly rather than faked.
 * Integrity notes come only from an issued verdict (hash verification at
 * arbitration), never presented as independent authentication.
 */
export function EvidenceCard({
  partyLabel,
  evidence,
  integrity,
}: {
  partyLabel: string;
  evidence: EvidenceView;
  integrity: boolean | null;
}) {
  const noEvidence = evidence.typeLabel === "No evidence submitted";
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          {partyLabel}
        </p>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink">
          {evidence.typeLabel}
        </span>
      </div>

      {noEvidence ? (
        <p className="mt-3 text-sm text-muted">
          {evidence.party === "respondent"
            ? "No evidence was submitted by the respondent."
            : "No evidence was submitted."}
        </p>
      ) : (
        <div className="mt-3">
          {evidence.content !== null ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {evidence.content}
            </p>
          ) : (
            <p className="text-sm text-muted">
              The evidence content itself is not exposed by the contract view
              {evidence.contentHash !== "" ? " - its content hash is:" : "."}
            </p>
          )}
          {evidence.contentHash !== "" ? (
            <p
              className="mt-2 break-all font-mono text-xs text-muted"
              title="Content hash (CID or Arweave transaction ID)"
            >
              {evidence.contentHash}
            </p>
          ) : null}
        </div>
      )}

      {integrity !== null ? (
        <p
          className={cn(
            "mt-3 border-t border-line pt-3 text-xs",
            integrity ? "text-attest-deep" : "text-status-danger",
          )}
        >
          {integrity
            ? "Content hash verified at arbitration."
            : "Content hash mismatch recorded at arbitration."}
        </p>
      ) : null}
    </div>
  );
}

export function TimestampField({
  label,
  seconds,
  advisory = false,
}: {
  label: string;
  seconds: number | null | undefined;
  advisory?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-2 text-xs">
      <span className="font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      <span className="text-ink">{formatDateTime(seconds)}</span>
      {advisory ? <span className="text-muted">(advisory)</span> : null}
    </span>
  );
}

export function CaseLink({
  disputeId,
  children,
}: {
  disputeId: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/cases/${disputeId}`}
      className="font-mono text-xs text-attest underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
