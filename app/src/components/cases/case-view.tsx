"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ContractReadError,
  getFinalityStatus,
  getRegistryAttestationByDispute,
  isMirrorFailed,
} from "@/lib/genlayer/reads";
import {
  finalizeDispute,
  triggerArbitration,
} from "@/lib/genlayer/writes";
import { getInjectedProvider } from "@/lib/wallet/injected";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  useAppealHistory,
  useAttestation,
  useDispute,
  useProtocolInfo,
  useVerdictHistory,
} from "@/lib/metatrial/queries";
import type { ViewerRole } from "@/lib/metatrial/types";
import { caseStage } from "@/lib/metatrial/my-cases";
import { toVerifiedAttestation } from "@/lib/metatrial/mappers";
import { formatDateTime } from "@/lib/utils/format";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AddressChip, CaseIdChip, StatusPill } from "./case-parts";
import { CopyableId } from "./copyable-id";
import { RespondPanel } from "./respond-panel";
import { AppealPanel } from "./appeal-panel";
import { SettlementSection } from "./settlement-section";
import { TransactionFlow } from "@/components/writes/transaction-flow";
import { CaseDeterminationSection } from "./case-determination-section";
import { CaseEvidence, CaseStatements } from "./case-record";
import { CaseAppeals, CaseFinalRecord } from "./case-history";

function viewerRole(detailClaimant: string, detailRespondent: string, walletAddress: string | null): ViewerRole {
  if (walletAddress === null) {
    return "other";
  }
  const wallet = walletAddress.toLowerCase();
  if (wallet === detailClaimant.toLowerCase()) {
    return "claimant";
  }
  if (wallet === detailRespondent.toLowerCase()) {
    return "respondent";
  }
  return "other";
}

function nextStepLine(
  status: string,
  opts: {
    participationDeadline: number;
    participationSkipped: boolean;
    appealWaived: boolean;
    appealWindowSeconds: number | null;
    lastVerdictRenderedAt: number | null;
  },
): string {
  if (status === "PARTICIPATION_OPEN") {
    if (opts.participationSkipped) {
      return "Participation was waived by both parties - arbitration can begin at any time.";
    }
    return `The respondent can add their side until ${formatDateTime(opts.participationDeadline)}. After that, arbitration proceeds on the submitted record.`;
  }
  if (status === "DELIBERATING") {
    return "The submitted record is being reviewed right now.";
  }
  if (status === "VERDICT_ISSUED") {
    if (opts.appealWaived) {
      return "Appeals were waived by both parties - this case can be finalized at any time.";
    }
    if (opts.lastVerdictRenderedAt !== null && opts.appealWindowSeconds !== null) {
      const appealDeadline = opts.lastVerdictRenderedAt + opts.appealWindowSeconds;
      return `Either party can file an appeal until ${formatDateTime(appealDeadline)} (advisory - the protocol enforces the window at filing time). After that, the case can be finalized.`;
    }
    return "Either party can file an appeal while the appeal window remains open. After that, the case can be finalized.";
  }
  if (status === "FINALIZED") {
    return "The record is sealed. The attestation below can be verified publicly at any time.";
  }
  if (status === "ABANDONED") {
    return "This case was withdrawn before arbitration and no determination will be made.";
  }
  if (status === "RESOLVED_BY_AGREEMENT") {
    return "Both parties resolved this case themselves - no determination will be made.";
  }
  return "";
}

function CaseSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-4">
      <div className="h-4 w-56 rounded bg-line" />
      <div className="h-9 w-2/3 rounded bg-line" />
      <div className="h-3 w-1/2 rounded bg-line" />
      <div className="h-3 w-1/3 rounded bg-line" />
    </div>
  );
}

export function CaseView({ disputeId }: { disputeId: string }) {
  const searchParams = useSearchParams();
  const origin = searchParams.get("from");
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const disputeQuery = useDispute(disputeId);
  const protocolInfo = useProtocolInfo();

  const detail = disputeQuery.data;
  const hasVerdict = detail?.hasVerdict === true;
  const isFinalized = detail?.status.key === "FINALIZED";

  const verdictHistoryQuery = useVerdictHistory(disputeId, hasVerdict);
  const appealHistoryQuery = useAppealHistory(disputeId, hasVerdict);
  const attestationQuery = useAttestation(disputeId, isFinalized);

  const finalityQuery = useQuery({
    queryKey: ["metatrial", "finality", disputeId],
    queryFn: () => getFinalityStatus(disputeId),
    enabled: isFinalized,
    staleTime: 15_000,
    retry: false,
  });
  const mirrorFailedQuery = useQuery({
    queryKey: ["metatrial", "mirror-failed", disputeId],
    queryFn: () => isMirrorFailed(disputeId),
    enabled: isFinalized,
    staleTime: 15_000,
  });
  const registryValidQuery = useQuery({
    queryKey: ["metatrial", "registry-attestation", "dispute", disputeId],
    queryFn: async () =>
      toVerifiedAttestation(await getRegistryAttestationByDispute(disputeId)),
    enabled:
      isFinalized && finalityQuery.data?.status === "INDEXED",
    staleTime: 60_000,
    retry: false,
  });

  if (disputeQuery.isLoading) {
    return (
      <Container className="py-16">
        <CaseSkeleton />
      </Container>
    );
  }

  if (disputeQuery.isError || detail === undefined) {
    const notFound =
      disputeQuery.error instanceof ContractReadError &&
      (disputeQuery.error as ContractReadError).code === "ERR:DISPUTE_NOT_FOUND";
    return (
      <Container className="flex flex-col items-center gap-5 py-28 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          {notFound ? "Case not found" : "Unavailable"}
        </p>
        <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
          {notFound
            ? "No case exists at this ID."
            : "This case could not be read right now."}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          {notFound
            ? `Nothing is recorded on the protocol for ${disputeId}. Case IDs look like MT-00000012-1a2b3c4d.`
            : "The protocol could not be reached. Please try again shortly."}
        </p>
        <ButtonLink href="/cases" variant="secondary">
          Browse cases
        </ButtonLink>
      </Container>
    );
  }

  const role = viewerRole(detail.claimant, detail.respondent, wallet.address);

  const rounds = verdictHistoryQuery.data ?? [];
  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const appealWindowSeconds =
    protocolInfo.data?.governance.appeal_window ?? null;
  const lastVerdictRenderedAt = currentRound?.renderedAt ?? null;

  const appealRemaining =
    role === "claimant"
      ? detail.appealBudget.claimantRemaining
      : role === "respondent"
        ? detail.appealBudget.respondentRemaining
        : 0;
  const appealWindowClosed =
    currentRound !== null &&
    appealWindowSeconds !== null &&
    Date.now() / 1000 > currentRound.renderedAt + appealWindowSeconds;
  const appealDeadline =
    currentRound !== null && appealWindowSeconds !== null
      ? currentRound.renderedAt + appealWindowSeconds
      : null;
  const showAppealPanel =
    detail.status.key === "VERDICT_ISSUED" &&
    detail.appealWaiver.effective === false &&
    (role === "claimant" || role === "respondent") &&
    appealRemaining > 0 &&
    appealWindowClosed === false &&
    currentRound !== null;

  // The status pill reflects the exact flow stage from THIS viewer's
  // perspective - the same derivation the action center uses.
  const status = caseStage(detail, role, {
    nowSeconds: Math.floor(Date.now() / 1000),
    currentAppealRound: currentRound?.appealRound ?? null,
    currentVerdictRenderedAt: currentRound?.renderedAt ?? null,
    appealWindowSeconds,
  });

  const nextStep = nextStepLine(detail.status.key, {
    participationDeadline: detail.participation.deadline,
    participationSkipped: detail.participation.effectiveSkip,
    appealWaived: detail.appealWaiver.effective,
    appealWindowSeconds,
    lastVerdictRenderedAt,
  });

  return (
    <Container className="py-12">
      {/* Contextual navigation: back to the place this case was opened from. */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        {origin === "my-cases" ? (
          <Link
            href="/my-cases"
            className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            ← Back to My Cases
          </Link>
        ) : origin === "explore" ? (
          <span className="flex flex-wrap items-center gap-2 text-muted">
            <Link href="/explore" className="underline-offset-4 hover:text-ink hover:underline">
              Explore
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/cases" className="underline-offset-4 hover:text-ink hover:underline">
              Cases
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink">
              {detail.caseNumber === null ? detail.id : `Case #${detail.caseNumber}`}
            </span>
          </span>
        ) : (
          <Link
            href="/cases"
            className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            ← Back to Cases
          </Link>
        )}
      </nav>

      {/* Above the fold: what is this case, what is its state, who is involved. */}
      <header>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CaseIdChip disputeId={detail.id} caseNumber={detail.caseNumber} />
          <CopyableId id={detail.id} label="Case ID" />
          <span className="rounded-full bg-attest-tint px-2.5 py-0.5 text-xs font-medium text-attest-deep">
            {detail.categoryLabel}
          </span>
          <StatusPill status={status} />
        </div>
        <h1 className="mt-4 max-w-3xl font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          {detail.title}
        </h1>
        {detail.context !== "" ? (
          <p className="mt-3 max-w-article text-sm leading-relaxed text-muted">
            {detail.context}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <AddressChip role="Claimant" address={detail.claimant} />
          <AddressChip role="Respondent" address={detail.respondent} />
          <span className="text-xs text-muted">
            Filed {formatDateTime(detail.createdAt)}
          </span>
        </div>
        {nextStep !== "" ? (
          <div className="mt-6 max-w-2xl rounded-xl border border-line bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              What happens next
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{nextStep}</p>
          </div>
        ) : null}

        {detail.status.key === "VERDICT_ISSUED" &&
        wallet.status === "connected" &&
        wallet.address !== null &&
        (detail.appealWaiver.effective === true ||
          (currentRound !== null &&
            detail.appealBudget.maxRounds <= currentRound.appealRound) ||
          (currentRound !== null &&
            appealWindowSeconds !== null &&
            Date.now() / 1000 >
              currentRound.renderedAt + appealWindowSeconds)) ? (
          <div className="mt-6 max-w-2xl">
            <TransactionFlow
              triggerLabel="Finalize the record"
              review={
                <p className="text-sm leading-relaxed text-ink">
                  Sealing makes the determination final and issues its public
                  attestation. Finalization is permissionless - any wallet can
                  perform it once the appeal window has passed, the appeal
                  budget is exhausted, or both parties waived appeals.
                </p>
              }
              run={() =>
                finalizeDispute({
                  walletAddress: wallet.address ?? "",
                  provider: getInjectedProvider(),
                  disputeId: detail.id,
                })
              }
              processingTitle="Sealing the record"
              processingNote="Finalization issues the attestation and updates the public verification index."
              successTitle="The record is final and attested."
              successNote="The attestation below can now be verified publicly by anyone."
              onSucceeded={() => {
                void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
              }}
            />
          </div>
        ) : null}

        {role === "respondent" &&
        detail.status.key === "PARTICIPATION_OPEN" &&
        detail.participation.participated === false ? (
          <div className="mt-6 max-w-2xl">
            <RespondPanel detail={detail} />
          </div>
        ) : null}

        {showAppealPanel === true &&
        (role === "claimant" || role === "respondent") &&
        currentRound !== null ? (
          <div className="mt-6 max-w-2xl">
            <AppealPanel
              disputeId={detail.id}
              current={currentRound}
              remaining={appealRemaining}
              appealDeadline={appealDeadline}
            />
          </div>
        ) : null}

        {role === "claimant" && detail.status.key === "PARTICIPATION_OPEN" ? (
          <div className="mt-6 max-w-2xl">
            <TransactionFlow
              triggerLabel="Start the review"
              disabled={
                detail.participation.effectiveSkip === false &&
                detail.participation.participated === false &&
                Date.now() / 1000 < detail.participation.deadline
              }
              disabledReason="The review can start once the participation window expires - or as soon as the respondent submits."
              run={() =>
                triggerArbitration({
                  walletAddress: wallet.address ?? "",
                  provider: getInjectedProvider(),
                  disputeId: detail.id,
                })
              }
              processingTitle="Reviewing the submitted evidence"
              processingNote="Independent validators evaluate the submitted record and issue a determination. This can take a few minutes - the page updates as soon as the decision is reached."
              successTitle="The review is complete."
              successNote="The determination appears below. If the appeal budget was exhausted or appeals were waived, the case may already be final."
              onSucceeded={() => {
                void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
              }}
            />
          </div>
        ) : null}
      </header>

      <div className="mt-12 space-y-10">
        <CaseStatements detail={detail} />
        <CaseEvidence
          detail={detail}
          integrityKnown={currentRound !== null}
          claimantIntegrity={currentRound?.claimantIntegrity ?? null}
          respondentIntegrity={currentRound?.respondentIntegrity ?? null}
        />

        {hasVerdict === false ? (
          <section
            id="the-review"
            className="scroll-mt-24 border-t border-line pt-10"
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
              The review
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink sm:text-3xl">
              Arbitration has not begun yet
            </h2>
            <p className="mt-4 max-w-article text-sm leading-relaxed text-muted">
              Once the participation window closes - or the respondent submits
              their side - the claimant can start the review. The submitted
              record is then evaluated and a determination is issued.
            </p>
          </section>
        ) : (
          <CaseDeterminationSection
            current={currentRound}
            rounds={rounds}
            loaded={verdictHistoryQuery.isLoading === false}
          />
        )}

        <CaseAppeals
          appeals={appealHistoryQuery.data ?? []}
          loaded={appealHistoryQuery.isLoading === false}
        />

        <SettlementSection disputeId={detail.id} />

        <CaseFinalRecord
          isFinalized={isFinalized}
          finalizedAt={detail.finalizedAt}
          attestation={attestationQuery.data}
          attestationLoaded={attestationQuery.isLoading === false}
          registryState={
            isFinalized && finalityQuery.data !== undefined
              ? {
                  status: finalityQuery.data.status,
                  mirrorFailed: mirrorFailedQuery.data === true,
                }
              : null
          }
          registryValid={
            isFinalized && finalityQuery.data?.status === "INDEXED"
              ? registryValidQuery.data?.isValid === true
              : null
          }
        />
      </div>
    </Container>
  );
}
