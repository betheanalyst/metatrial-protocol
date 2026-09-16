/**
 * Governance translations - administrative language, human-readable
 * proposal states and action types, derived strictly from contract data
 * (MetaTrialGovernance + Core's governance-facing views).
 */

export const ACTION_LABELS: Record<string, string> = {
  ADD_ADMIN: "Add admin",
  REMOVE_ADMIN: "Remove admin",
  CORE_PARAM_UPDATE: "Protocol parameter update",
  TREASURY_UPDATE: "Treasury update",
  EXTERNAL_SOURCE_UPDATE: "External source update",
  PAUSE: "Emergency pause",
  UNPAUSE: "Lift pause",
};

export function actionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType;
}

export const PROPOSAL_STATUS: Record<
  string,
  { label: string; tone: "pending" | "active" | "final" | "muted" | "danger" }
> = {
  PENDING_APPROVALS: {
    label: "Pending approvals",
    tone: "pending",
  },
  TIMELOCKED: {
    label: "Timelocked - ready to execute",
    tone: "active",
  },
  EXECUTED: {
    label: "Executed",
    tone: "final",
  },
  EXPIRED: {
    label: "Expired",
    tone: "danger",
  },
};

export function proposalStatusLabel(status: string): {
  label: string;
  tone: "pending" | "active" | "final" | "muted" | "danger";
} {
  return (
    PROPOSAL_STATUS[status] ?? { label: status, tone: "muted" as const }
  );
}

/** Human duration for governance windows stored in seconds. */
export function humanDuration(seconds: number): string {
  if (seconds % 86_400 === 0 && seconds >= 86_400) {
    const days = seconds / 86_400;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (seconds % 3_600 === 0 && seconds >= 3_600) {
    const hours = seconds / 3_600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${seconds} seconds`;
}

export interface ProtocolParams {
  participation_window: number;
  appeal_window: number;
  max_appeal_rounds: number;
  confidence_tolerance: number;
  max_disputes_per_respondent_window: number;
  max_disputes_per_claimant_window: number;
}

export const PARAM_LABELS: Record<keyof ProtocolParams, string> = {
  participation_window: "Participation window",
  appeal_window: "Appeal window",
  max_appeal_rounds: "Maximum appeal rounds",
  confidence_tolerance: "Confidence tolerance",
  max_disputes_per_respondent_window: "Respondent rate limit (per 24h)",
  max_disputes_per_claimant_window: "Claimant rate limit (per 24h)",
};

/** Windows are seconds; the rest are plain counts/tolerances. */
export function formatParam(key: keyof ProtocolParams, value: number): string {
  if (key === "participation_window" || key === "appeal_window") {
    return humanDuration(value);
  }
  return String(value);
}
