"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDisputeSettlements, getSettlement } from "@/lib/genlayer/reads";
import { claimSettlement } from "@/lib/genlayer/writes";
import { getInjectedProvider } from "@/lib/wallet/injected";
import { useWallet } from "@/lib/wallet/wallet-context";
import { toSettlement } from "@/lib/metatrial/mappers";
import { SETTLEMENT_STATUS_LABELS } from "@/lib/metatrial/labels";
import { formatDateTime, formatGenAmount, shortenAddress } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { TransactionFlow } from "@/components/writes/transaction-flow";
import type { Settlement } from "@/lib/metatrial/types";

function SettlementBlock({ settlement }: { settlement: Settlement }) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const isRecipient =
    wallet.address !== null &&
    settlement.recipient.toLowerCase() === wallet.address.toLowerCase();
  const delivered = settlement.claimStatus === "DELIVERED";

  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-5 py-4",
        delivered === false ? "border-attest/40" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            delivered === false
              ? "bg-attest-tint text-attest-deep"
              : "bg-attest text-paper",
          )}
        >
          {SETTLEMENT_STATUS_LABELS[settlement.claimStatus] ?? settlement.claimStatus}
        </span>
        <span className="text-xs text-muted">
          {delivered === false
            ? `Authorized ${formatDateTime(settlement.authorizedAt)}`
            : `Delivered ${formatDateTime(settlement.deliveredAt)}`}
        </span>
      </div>

      <p className="mt-2.5 text-base font-semibold tracking-tight text-ink">
        {settlement.purposeLabel} -{""}
        <span
          title={`${settlement.amountWei.toString()} wei`}
          className="tabular-nums"
        >
          {formatGenAmount(settlement.amountWei)}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted">
        Recipient{" "}
        <span className="font-mono text-ink">
          {shortenAddress(settlement.recipient)}
        </span>
        {isRecipient ? " - this is you" : ""}
      </p>
      {delivered === true && settlement.deliveredBy !== "" ? (
        <p className="mt-1 text-xs text-muted">
          Delivered on-chain by{" "}
          <span className="font-mono">{shortenAddress(settlement.deliveredBy)}</span>
          {isRecipient === false ? " - delivery is permissionless" : ""}
        </p>
      ) : null}

      {delivered === false &&
      wallet.status === "connected" &&
      wallet.address !== null ? (
        <div className="mt-4">
          <TransactionFlow
            triggerLabel={
              isRecipient === true
                ? "Claim this payment"
                : "Deliver this payment"
            }
            review={
              <p className="text-sm leading-relaxed text-ink">
                {isRecipient === true
                  ? "This performs the on-chain transfer of the authorized amount to your address. Delivery is permissionless and idempotent."
                  : "Delivery is permissionless - any wallet can trigger the on-chain transfer to the designated recipient."}
              </p>
            }
            run={() =>
              claimSettlement({
                walletAddress: wallet.address ?? "",
                provider: getInjectedProvider(),
                settlementId: settlement.id,
              })
            }
            processingTitle="Delivering the payment on-chain"
            processingNote="The protocol performs the transfer directly - delivery is confirmed by the transaction itself."
            successTitle="Payment delivered."
            successNote="The on-chain transfer completed - this settlement is now marked delivered."
            secondaryLabel="Dismiss"
            onSucceeded={() => {
              void queryClient.invalidateQueries({ queryKey: ["metatrial"] });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SettlementSection({ disputeId }: { disputeId: string }) {
  const idsQuery = useQuery({
    queryKey: ["metatrial", "settlement-ids", disputeId],
    queryFn: () => getDisputeSettlements(disputeId),
    staleTime: 15_000,
  });

  const settlementIds = idsQuery.data ?? [];
  const detailQueries = useQueries({
    queries: settlementIds.map((settlementId) => ({
      queryKey: ["metatrial", "settlement", settlementId],
      queryFn: async () => toSettlement(await getSettlement(settlementId)),
      staleTime: 15_000,
    })),
  });

  if (idsQuery.isLoading) {
    return null;
  }
  if (settlementIds.length === 0) {
    return null;
  }
  const settlements = detailQueries
    .map((entry) => entry.data)
    .filter((entry) => entry !== undefined);
  if (settlements.length === 0 && detailQueries.some((entry) => entry.isLoading)) {
    return null;
  }

  return (
    <section id="settlement" className="scroll-mt-24 border-t border-line pt-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
        Settlement
      </p>
      <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink sm:text-3xl">
        Fee &amp; bond movements on this case
      </h2>
      <p className="mt-3 max-w-article text-sm leading-relaxed text-muted">
        MetaTrial is not a general escrow - these records cover only filing
        fees and appeal bonds. Authorized payments are delivered on-chain by a
        permissionless claim.
      </p>
      <div className="mt-6 space-y-4">
        {settlements.map((settlement) => (
          <SettlementBlock key={settlement.id} settlement={settlement} />
        ))}
      </div>
    </section>
  );
}
