"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  disputeExists,
  getAttestationByExternalRef,
  getFinalityStatus,
  getRegistryAttestation,
  getRegistryAttestationByDispute,
  isMirrorFailed,
} from "@/lib/genlayer/reads";
import { toAttestation, toVerifiedAttestation } from "@/lib/metatrial/mappers";
import {
  detectVerificationMode,
  finalityDisplay,
} from "@/lib/metatrial/verification";
import type { Attestation, VerifiedAttestation } from "@/lib/metatrial/types";
import { ContractReadError } from "@/lib/genlayer/errors";
import { useWallet } from "@/lib/wallet/wallet-context";
import { getInjectedProvider } from "@/lib/wallet/injected";
import { retryMirror } from "@/lib/genlayer/writes";
import { formatConfidence, formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TransactionFlow } from "@/components/writes/transaction-flow";

const TONE_CLASSES = {
  final: "border-attest bg-attest text-paper",
  pending: "border-status-pending/40 bg-status-pending/10 text-status-pending",
  muted: "border-line bg-white text-muted",
  danger: "border-status-danger/40 bg-status-danger/10 text-status-danger",
} as const;

function VerdictBadge({
  question,
  answer,
  tone,
}: {
  question: string;
  answer: string;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        TONE_CLASSES[tone],
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] opacity-80">
        {question}
      </p>
      <p className="mt-1 text-sm font-semibold">{answer}</p>
    </div>
  );
}

function AttestationCertificate({
  attestation,
}: {
  attestation: Attestation | VerifiedAttestation;
}) {
  const isValid =
    (attestation as VerifiedAttestation).isValid !== undefined
      ? (attestation as VerifiedAttestation).isValid
      : true;
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-6 sm:px-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-ink">
        MetaTrial Attestation
      </p>
      <dl className="mt-5 flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Attestation</dt>
          <dd className="max-w-[60%] truncate font-mono text-xs text-ink" title={attestation.id}>
            {attestation.id}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Case</dt>
          <dd>
            <Link
              href={`/cases/${attestation.disputeId}`}
              className="font-mono text-xs text-attest underline-offset-4 hover:underline"
            >
              {attestation.disputeId}
            </Link>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Final determination</dt>
          <dd className="font-medium text-ink">{attestation.rulingLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Issued</dt>
          <dd className="text-ink">{formatDateTime(attestation.issuedAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Appeal rounds</dt>
          <dd className="tabular-nums text-ink">{attestation.appealRoundsUsed}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Respondent participated</dt>
          <dd className="text-ink">{attestation.respondentParticipated ? "Yes" : "No"}</dd>
        </div>
        {attestation.externalRef !== "" ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">External reference</dt>
            <dd className="max-w-[60%] truncate font-mono text-xs text-ink" title={attestation.externalRef}>
              {attestation.externalRef}
            </dd>
          </div>
        ) : null}
        {isValid === false ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Revoked (reason)</dt>
            <dd className="max-w-[60%] text-xs text-status-danger">
              {(attestation as VerifiedAttestation).registryRevokeReason !== ""
                ? (attestation as VerifiedAttestation).registryRevokeReason
                : "revoked"}
            </dd>
          </div>
        ) : null}
      </dl>
      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer text-xs text-muted">
          Technical details
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Machine-readable ruling code: {attestation.rulingCode} · confidence{""}
          {formatConfidence(attestation.confidence)} · primary finding{""}
          {attestation.primaryFindingLabel}
          {attestation.remedyLabel !== "NO_REMEDY"
            ? ` · remedy ${attestation.remedyLabel}`
            : ""}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {attestation.basisOfDetermination}
        </p>
      </details>
    </div>
  );
}

function LoadingState({ id }: { id: string }) {
  return (
    <Container className="py-16">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">Verifying</p>
      <p className="mt-2 font-mono text-xs text-muted" title={id}>{id}</p>
      <div className="mt-8 max-w-xl animate-pulse space-y-3">
        <div className="h-4 w-48 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-4 w-1/2 rounded bg-line" />
      </div>
    </Container>
  );
}

function UnavailableState({ id, hint }: { id: string; hint?: string }) {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">Unavailable</p>
      <h1 className="font-serif text-2xl tracking-tight text-ink sm:text-3xl">
        This record could not be verified right now.
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        {hint ?? "The protocol could not be reached. Please try again shortly."}
      </p>
      <p className="font-mono text-xs text-muted" title={id}>{id}</p>
      <ButtonLink href="/verify" variant="secondary">Try another record</ButtonLink>
    </Container>
  );
}

export function VerifyResult({ id }: { id: string }) {
  const mode = detectVerificationMode(id);
  const wallet = useWallet();

  // Case mode: the tri-state resolution comes first - it distinguishes
  // "never finalized" from "finalized but the mirror has not landed".
  const finalityQuery = useQuery({
    queryKey: ["metatrial", "finality", id],
    queryFn: () => getFinalityStatus(id),
    enabled: mode === "case",
    staleTime: 15_000,
    retry: (failureCount, error) =>
      error instanceof ContractReadError ? false : failureCount < 2,
  });

  const finality = mode === "case" ? finalityQuery.data : undefined;
  const registryByDisputeQuery = useQuery({
    queryKey: ["metatrial", "registry-attestation", "dispute", id],
    queryFn: async () => toVerifiedAttestation(await getRegistryAttestationByDispute(id)),
    enabled: mode === "case" && finality?.status === "INDEXED",
    staleTime: 60_000,
    retry: false,
  });
  const coreAttestationQuery = useQuery({
    queryKey: ["metatrial", "core-attestation", id],
    queryFn: async () => toAttestation(await (await import("@/lib/genlayer/reads")).getAttestationByDispute(id)),
    enabled: mode === "case" && finality?.status === "FINAL_PENDING_MIRROR",
    staleTime: 60_000,
    retry: false,
  });
  const mirrorFailedQuery = useQuery({
    queryKey: ["metatrial", "mirror-failed", id],
    queryFn: () => isMirrorFailed(id),
    enabled: mode === "case" && finality?.status === "FINAL_PENDING_MIRROR",
    staleTime: 15_000,
  });
  const existsQuery = useQuery({
    queryKey: ["metatrial", "dispute-exists", id],
    queryFn: () => disputeExists(id),
    enabled: mode === "case" && finality?.status === "NOT_FINAL",
    staleTime: 30_000,
  });

  const attestationByIdQuery = useQuery({
    queryKey: ["metatrial", "registry-attestation", "id", id],
    queryFn: async () => toVerifiedAttestation(await getRegistryAttestation(id)),
    enabled: mode === "attestation",
    staleTime: 60_000,
    retry: false,
  });

  const attestationByRefQuery = useQuery({
    queryKey: ["metatrial", "registry-attestation", "ref", id],
    queryFn: async () => toVerifiedAttestation(await getAttestationByExternalRef(id)),
    enabled: mode === "external",
    staleTime: 60_000,
    retry: false,
  });

  if (mode === "case" && finalityQuery.isLoading) {
    return <LoadingState id={id} />;
  }
  if (mode === "attestation" && attestationByIdQuery.isLoading) {
    return <LoadingState id={id} />;
  }
  if (mode === "external" && attestationByRefQuery.isLoading) {
    return <LoadingState id={id} />;
  }

  /* ---------- Case mode ---------- */
  if (mode === "case") {
    if (finalityQuery.isError || finality === undefined) {
      return <UnavailableState id={id} />;
    }
    const display = finalityDisplay(finality.status);

    if (finality.status === "NOT_FINAL") {
      const exists = existsQuery.data === true;
      return (
        <Container className="py-16">
          <p className="font-mono text-xs text-muted" title={id}>{id}</p>
          <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
            <VerdictBadge
              question="Is this record real?"
              answer={exists ? "Yes - the case exists" : "No case with this ID"}
              tone={exists ? "pending" : "muted"}
            />
            <VerdictBadge
              question="Is the determination final?"
              answer="Not final"
              tone="muted"
            />
          </div>
          <div className={cn("mt-6 rounded-xl border px-5 py-4", TONE_CLASSES.pending)}>
            <p className="text-sm font-medium text-status-pending">{display.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">
              {exists
                ? "This case exists on the protocol but has no final determination yet. Once it is finalized, its attestation becomes publicly verifiable here."
                : "Nothing is recorded on the protocol for this ID. Case IDs look like MT-00000012-1a2b3c4d."}
            </p>
          </div>
          <div className="mt-6">
            <ButtonLink href="/cases" variant="secondary">Browse cases</ButtonLink>
          </div>
        </Container>
      );
    }

    if (finality.status === "FINAL_PENDING_MIRROR") {
      const coreAttestation = coreAttestationQuery.data;
      const mirrorFailed = mirrorFailedQuery.data === true;
      return (
        <Container className="py-16">
          <p className="font-mono text-xs text-muted" title={id}>{id}</p>
          <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
            <VerdictBadge question="Is this record real?" answer="Yes - final on the protocol" tone="final" />
            <VerdictBadge question="Is the determination final?" answer="Yes - final" tone="final" />
          </div>
          <div className={cn("mt-6 rounded-xl border px-5 py-4", TONE_CLASSES.pending)}>
            <p className="text-sm font-medium text-status-pending">{display.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{display.description}</p>
            {mirrorFailed ? (
              <p className="mt-2 text-sm text-status-pending">
                The automatic index update did not complete. Any wallet can
                retry it - it is permissionless and safe to repeat.
              </p>
            ) : null}
          </div>
          {mirrorFailed && wallet.status === "connected" && wallet.address !== null ? (
            <div className="mt-6 max-w-2xl">
              <TransactionFlow
                triggerLabel="Retry the registry update"
                run={() =>
                  retryMirror({
                    walletAddress: wallet.address ?? "",
                    provider: getInjectedProvider(),
                    disputeId: id,
                  })
                }
                processingTitle="Re-confirming the registry index"
                successTitle="The registry update was confirmed."
                successNote="Re-run the verification to see the indexed state."
                onSucceeded={() => {
                  void window.location.reload();
                }}
              />
            </div>
          ) : null}
          {coreAttestation !== undefined ? (
            <div className="mt-8 max-w-2xl">
              <AttestationCertificate attestation={coreAttestation} />
              <p className="mt-3 text-xs text-muted">
                Shown from the protocol record. The public index entry above is
                still synchronizing.
              </p>
            </div>
          ) : null}
        </Container>
      );
    }

    // INDEXED
    if (registryByDisputeQuery.isLoading) {
      return <LoadingState id={id} />;
    }
    const attestation = registryByDisputeQuery.data;
    if (attestation === undefined) {
      return <UnavailableState id={id} />;
    }
    return (
      <Container className="py-16">
        <p className="font-mono text-xs text-muted" title={id}>{id}</p>
        <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
          <VerdictBadge question="Is this record real?" answer="Yes - indexed" tone="final" />
          <VerdictBadge question="Is the determination final?" answer="Yes - final" tone="final" />
          <VerdictBadge
            question="Is the attestation valid?"
            answer={attestation.isValid === true ? "Yes - valid" : "No - revoked"}
            tone={attestation.isValid === true ? "final" : "danger"}
          />
        </div>
        <div className="mt-6 max-w-2xl rounded-xl border border-attest/40 bg-attest-tint px-5 py-4">
          <p className="text-sm font-medium text-attest-deep">{display.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{display.description}</p>
        </div>
        <div className="mt-8 max-w-2xl">
          <AttestationCertificate attestation={attestation} />
        </div>
      </Container>
    );
  }

  /* ---------- Attestation / external-ref modes ---------- */
  const query = mode === "attestation" ? attestationByIdQuery : attestationByRefQuery;
  if (query.isError || query.data === undefined) {
    const notIndexed =
      query.error instanceof ContractReadError &&
      ((query.error as ContractReadError).code === "ERR:NOT_INDEXED" ||
        (query.error as ContractReadError).code === "ERR:EXTERNAL_REF_NOT_FOUND");
    if (notIndexed === true) {
      return (
        <Container className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">Not found</p>
          <h1 className="max-w-xl font-serif text-2xl tracking-tight text-ink sm:text-3xl">
            {mode === "attestation"
              ? "No attestation is indexed under this ID."
              : "No attestation is indexed under this external reference."}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            {mode === "attestation"
              ? "If the case was finalized very recently, the public index may still be synchronizing - verifying by Case ID resolves that distinction."
              : "Check the exact reference the platform recorded on the case."}
          </p>
          <p className="font-mono text-xs text-muted" title={id}>{id}</p>
          <ButtonLink href="/verify" variant="secondary">Try another record</ButtonLink>
        </Container>
      );
    }
    return <UnavailableState id={id} />;
  }

  const attestation = query.data;
  return (
    <Container className="py-16">
      <p className="font-mono text-xs text-muted" title={id}>{id}</p>
      <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
        <VerdictBadge question="Is this record real?" answer="Yes - indexed" tone="final" />
        <VerdictBadge question="Is the determination final?" answer="Yes - final" tone="final" />
        <VerdictBadge
          question="Is the attestation valid?"
          answer={attestation.isValid === true ? "Yes - valid" : "No - revoked"}
          tone={attestation.isValid === true ? "final" : "danger"}
        />
      </div>
      <div className="mt-8 max-w-2xl">
        <AttestationCertificate attestation={attestation} />
      </div>
    </Container>
  );
}
