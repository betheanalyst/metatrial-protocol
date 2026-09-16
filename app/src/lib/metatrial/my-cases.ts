import type { CaseDetail } from "./types";

/**
 * The connected-user action center classification (Experience Blueprint §15):
 * derived strictly from contract data - never an independent fictional state
 * machine. Timing checks are advisory (the protocol enforces all windows at
 * transaction time); `nowSeconds` is injected for purity and testability.
 */

export type MyCaseBucket = "needs-action" | "active" | "completed";

export interface CaseStage {
  key: string;
  label: string;
  tone: "pending" | "active" | "final" | "muted";
  description: string;
  actionLabel: string | null;
}

/**
 * The single, exhaustive stage derivation for a case from the viewer's
 * perspective. Both the case-page status pill and the My Cases action
 * center derive from this one function, so the two surfaces can never
 * disagree about where a case is in its flow.
 */
export function caseStage(
  detail: CaseDetail,
  viewerRole: "claimant" | "respondent" | "other",
  context: {
    nowSeconds: number;
    currentAppealRound: number | null;
    currentVerdictRenderedAt: number | null;
    appealWindowSeconds: number | null;
  },
): CaseStage {
  const status = detail.status.key;

  if (status === "FINALIZED") {
    return {
      key: "final",
      label: "Final determination",
      tone: "final",
      description: "The record is sealed and attested.",
      actionLabel: null,
    };
  }
  if (status === "ABANDONED") {
    return {
      key: "withdrawn",
      label: "Withdrawn",
      tone: "muted",
      description: "Withdrawn before arbitration.",
      actionLabel: null,
    };
  }
  if (status === "RESOLVED_BY_AGREEMENT") {
    return {
      key: "resolved",
      label: "Resolved by both parties",
      tone: "muted",
      description: "Resolved without arbitration.",
      actionLabel: null,
    };
  }

  if (status === "PARTICIPATION_OPEN" && viewerRole === "other") {
    return {
      key: "awaiting-participation",
      label: "Waiting for participation",
      tone: "pending",
      description:
        "This case is on the public record. The review begins after the participation window closes.",
      actionLabel: null,
    };
  }

  if (status === "PARTICIPATION_OPEN") {
    if (detail.participation.effectiveSkip === true) {
      return viewerRole === "claimant"
        ? {
            key: "ready-for-review",
            label: "Ready for review",
            tone: "active",
            description: "Participation was waived by both parties.",
            actionLabel: "Start the review",
          }
        : {
            key: "awaiting-claimant-review",
            label: "Waiting for the claimant to start the review",
            tone: "pending",
            description: "Participation was waived - the review can start at any time.",
            actionLabel: null,
          };
    }
    if (viewerRole === "respondent" && detail.participation.participated === false) {
      return {
        key: "awaiting-response",
        label: "Your response is needed",
        tone: "pending",
        description:
          "The claimant has filed this case and the window is open for your side. Responding is optional, but silence is recorded.",
        actionLabel: "Respond to this case",
      };
    }
    if (viewerRole === "claimant" && detail.participation.participated === true) {
      return {
        key: "ready-for-review",
        label: "Ready for review",
        tone: "active",
        description: "The respondent has submitted - the review can begin.",
        actionLabel: "Start the review",
      };
    }
    if (
      viewerRole === "claimant" &&
      context.nowSeconds >= detail.participation.deadline
    ) {
      return {
        key: "ready-for-review",
        label: "Ready for review",
        tone: "active",
        description: "The participation window has closed.",
        actionLabel: "Start the review",
      };
    }
    if (viewerRole === "respondent") {
      return {
        key: "awaiting-claimant-review",
        label: "Waiting for the claimant to start the review",
        tone: "pending",
        description: "Your response is on the record - the review starts when the claimant begins it or the window closes.",
        actionLabel: null,
      };
    }
    return {
      key: "awaiting-participation",
      label: "Waiting for participation",
      tone: "pending",
      description: "The respondent has until the window closes to add their side.",
      actionLabel: null,
    };
  }

  if (status === "VERDICT_ISSUED") {
    const budgetExhausted =
      context.currentAppealRound !== null &&
      detail.appealBudget.maxRounds <= context.currentAppealRound;
    const windowClosed =
      context.currentVerdictRenderedAt !== null &&
      context.appealWindowSeconds !== null &&
      context.nowSeconds >
        context.currentVerdictRenderedAt + context.appealWindowSeconds;
    if (
      detail.appealWaiver.effective === true ||
      budgetExhausted === true ||
      windowClosed === true
    ) {
      return {
        key: "ready-to-finalize",
        label: "Ready to finalize",
        tone: "active",
        description:
          "The appeal window has closed, the appeal budget is exhausted, or appeals were waived - the record can be sealed.",
        actionLabel: viewerRole === "other" ? null : "Finalize the record",
      };
    }
    return {
      key: "decision-issued",
      label: "Decision issued - appeal window open",
      tone: "active",
      description:
        "Either party can challenge the determination while the window is open.",
      actionLabel: null,
    };
  }

  if (status === "DELIBERATING") {
    return {
      key: "reviewing",
      label: "Reviewing submitted evidence",
      tone: "pending",
      description: "The submitted record is being evaluated.",
      actionLabel: null,
    };
  }

  return {
    key: "unknown",
    label: "Unknown state",
    tone: "muted",
    description: "This state could not be translated.",
    actionLabel: null,
  };
}


export interface MyCaseClassification {
  bucket: MyCaseBucket;
  actionLabel: string | null;
  note: string;
}

export function classifyMyCase(
  role: "claimant" | "respondent",
  detail: CaseDetail,
  context: {
    nowSeconds: number;
    currentAppealRound: number | null;
    currentVerdictRenderedAt: number | null;
    appealWindowSeconds: number | null;
  },
): MyCaseClassification {
  const stage = caseStage(detail, role, context);
  const bucket: MyCaseBucket =
    stage.tone === "final" || stage.tone === "muted"
      ? "completed"
      : stage.actionLabel !== null
        ? "needs-action"
        : "active";
  return {
    bucket,
    actionLabel: stage.actionLabel,
    note: stage.description,
  };
}
