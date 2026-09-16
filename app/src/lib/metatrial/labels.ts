import type { HumanStatus, ViewerRole } from "./types";

/**
 * Protocol state -> human language, per the MetaTrial Experience Blueprint
 * (human state translation) and the Visual Handoff (data-to-UX rules).
 * Raw values remain available through progressive disclosure, never as the
 * primary label.
 */

const STATUS_PARTICIPATION_OPEN: HumanStatus = {
  key: "PARTICIPATION_OPEN",
  label: "Waiting for participation",
  viewerLabel: "Your response is needed",
  description:
    "The respondent has an open window to add their side of the case. Arbitration proceeds regardless once the window closes.",
  tone: "pending",
};

const STATUS_DELIBERATING: HumanStatus = {
  key: "DELIBERATING",
  label: "Reviewing submitted evidence",
  viewerLabel: null,
  description:
    "The submitted record is being evaluated through consensus. This state normally resolves within a single transaction.",
  tone: "pending",
};

const STATUS_VERDICT_ISSUED: HumanStatus = {
  key: "VERDICT_ISSUED",
  label: "Decision issued",
  viewerLabel: null,
  description:
    "A determination has been issued. It can still be challenged within the appeal window.",
  tone: "active",
};

const STATUS_FINALIZED: HumanStatus = {
  key: "FINALIZED",
  label: "Final determination",
  viewerLabel: null,
  description:
    "The determination is final and the record is sealed. An attestation has been issued.",
  tone: "final",
};

const STATUS_ABANDONED: HumanStatus = {
  key: "ABANDONED",
  label: "Withdrawn",
  viewerLabel: null,
  description:
    "The claimant withdrew this case before arbitration began. No determination was made.",
  tone: "muted",
};

const STATUS_RESOLVED_BY_AGREEMENT: HumanStatus = {
  key: "RESOLVED_BY_AGREEMENT",
  label: "Resolved by both parties",
  viewerLabel: null,
  description:
    "Both parties agreed to resolve this case without arbitration. No determination was made.",
  tone: "muted",
};

const UNKNOWN_STATUS: HumanStatus = {
  key: "UNKNOWN",
  label: "Unknown state",
  viewerLabel: null,
  description:
    "This case is in a state the application cannot translate. The raw state remains available below.",
  tone: "muted",
};

const STATUS_MAP: Record<string, HumanStatus> = {
  PARTICIPATION_OPEN: STATUS_PARTICIPATION_OPEN,
  DELIBERATING: STATUS_DELIBERATING,
  VERDICT_ISSUED: STATUS_VERDICT_ISSUED,
  FINALIZED: STATUS_FINALIZED,
  ABANDONED: STATUS_ABANDONED,
  RESOLVED_BY_AGREEMENT: STATUS_RESOLVED_BY_AGREEMENT,
};

export function humanStatus(status: string, viewerRole: ViewerRole = "other"): HumanStatus {
  const base = STATUS_MAP[status] ?? { ...UNKNOWN_STATUS, key: status };
  if (viewerRole === "respondent" && base.viewerLabel !== null) {
    return { ...base, label: base.viewerLabel };
  }
  return base;
}

export const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  CONDUCT: "Conduct",
  CONTENT: "Content",
  CUSTOM: "Custom",
  DELIVERY: "Delivery",
  INTELLECTUAL_PROPERTY: "Intellectual property",
  PAYMENT: "Payment",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export const RULING_LABELS: Record<string, string> = {
  CLAIMANT_PREVAILS: "Claimant prevails",
  RESPONDENT_PREVAILS: "Respondent prevails",
  SPLIT_DECISION: "Split decision",
  INCONCLUSIVE: "Inconclusive",
  INCONCLUSIVE_FINAL: "Inconclusive (final)",
};

export function rulingLabel(ruling: string): string {
  return RULING_LABELS[ruling] ?? ruling;
}

export const APPEAL_GROUND_LABELS: Record<string, string> = {
  NEW_EVIDENCE: "New evidence",
  PROCEDURAL_ERROR: "Procedural error",
  EVIDENCE_INTEGRITY: "Evidence integrity",
  REASONING_DEFECT: "Reasoning defect",
};

export function appealGroundLabel(ground: string): string {
  return APPEAL_GROUND_LABELS[ground] ?? ground;
}

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  INLINE_TEXT: "Inline text",
  URL: "Content-addressed URL",
  FILE_REFERENCE: "File reference",
};

export function evidenceTypeLabel(type: string): string {
  if (type === "" || type === undefined || type === null) {
    return "No evidence submitted";
  }
  return EVIDENCE_TYPE_LABELS[type] ?? type;
}

export const REMEDY_LABELS: Record<string, string> = {
  PARTIAL_PAYMENT: "Partial payment",
  FULL_PAYMENT: "Full payment",
  SERVICE_COMPLETION: "Service completion",
  APOLOGY: "Apology",
  NO_REMEDY: "No remedy",
  CONDITIONAL: "Conditional remedy",
  CUSTOM: "Custom remedy",
};

export function remedyLabel(remedy: string): string {
  return REMEDY_LABELS[remedy] ?? remedy;
}

export const EVIDENCE_QUALITY_LABELS: Record<string, string> = {
  STRONG: "Strong",
  MODERATE: "Moderate",
  WEAK: "Weak",
  ABSENT: "Absent",
};

export function evidenceQualityLabel(quality: string): string {
  return EVIDENCE_QUALITY_LABELS[quality] ?? quality;
}

export const FINDING_LABELS: Record<string, string> = {
  CONTRACT_BREACH: "Contract breach",
  NO_BREACH_FOUND: "No breach found",
  MUTUAL_FAULT: "Mutual fault",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
  CLAIMS_UNSUBSTANTIATED: "Claims unsubstantiated",
  PROCEDURAL_IRREGULARITY: "Procedural irregularity",
};

export function findingLabel(finding: string): string {
  return FINDING_LABELS[finding] ?? finding;
}

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  AUTHORIZED: "Payment ready to claim",
  DELIVERED: "Payment delivered",
};
