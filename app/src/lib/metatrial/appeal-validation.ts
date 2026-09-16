/**
 * Structured appeal grounds, exactly as the contract defines them
 * (metatrial_core.py file_appeal): four typed grounds, each mandating
 * substantively populated sub-fields - length alone is not sufficient.
 * Client-side validation mirrors the contract's rules so users get precise
 * feedback before signing; the contract remains authoritative.
 */

export const APPEAL_GROUNDS = [
  {
    type: "NEW_EVIDENCE",
    label: "New evidence",
    summary: "Evidence that was not available or not submitted in the prior round.",
    guidance: {
      explanation: "What the new evidence is",
      specific: "Why it was not submitted in the prior round",
      impact: "How it would change the outcome",
    },
  },
  {
    type: "PROCEDURAL_ERROR",
    label: "Procedural error",
    summary: "A specific procedural rule was violated during the proceeding.",
    guidance: {
      explanation: "Which rule was violated",
      specific: "At which stage it occurred",
      impact: "How it affected the outcome",
    },
  },
  {
    type: "EVIDENCE_INTEGRITY",
    label: "Evidence integrity",
    summary: "A specific evidence item is questioned (hash mismatch, suspected forgery).",
    guidance: {
      explanation: "Which evidence item is questioned",
      specific: "The integrity concern",
      impact: "The basis for the concern",
    },
  },
  {
    type: "REASONING_DEFECT",
    label: "Reasoning defect",
    summary: "A specific finding in the determination is logically incorrect or unsupported.",
    guidance: {
      explanation: "Which finding is defective",
      specific: "Why it is wrong",
      impact: "What the correct finding should be",
    },
  },
] as const;

export const APPEAL_LIMITS = {
  explanationMin: 80,
  specificMin: 60,
  impactMin: 40,
  max: 500,
  precedents: 5,
  externalUrls: 2,
  externalUrl: 1000,
} as const;

export interface AppealDraft {
  groundType: string;
  explanation: string;
  specific: string;
  impact: string;
  precedentIds: string[];
  externalUrls: string[];
}

const DISPUTE_ID_PATTERN = /^MT-\d{8}-[0-9a-fA-F]{8}$/;

/** Returns per-field human error messages; empty object means valid. */
export function validateAppeal(draft: AppealDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const ground = APPEAL_GROUNDS.find((entry) => entry.type === draft.groundType);
  if (ground === undefined) {
    errors.groundType = "Choose one of the four appeal grounds.";
    return errors;
  }
  const checks = [
    {
      field: "explanation" as const,
      value: draft.explanation,
      min: APPEAL_LIMITS.explanationMin,
      label: "Explanation",
    },
    {
      field: "specific" as const,
      value: draft.specific,
      min: APPEAL_LIMITS.specificMin,
      label: "The specific issue",
    },
    {
      field: "impact" as const,
      value: draft.impact,
      min: APPEAL_LIMITS.impactMin,
      label: "Impact",
    },
  ];
  for (const check of checks) {
    const trimmed = check.value.trim();
    if (trimmed.length < check.min) {
      errors[check.field] = `${check.label} must be at least ${check.min} characters (${ground.guidance[check.field]}).`;
    } else if (check.value.length > APPEAL_LIMITS.max) {
      errors[check.field] = `${check.label} is limited to ${APPEAL_LIMITS.max} characters.`;
    }
  }
  if (draft.precedentIds.length > APPEAL_LIMITS.precedents) {
    errors.precedentIds = `At most ${APPEAL_LIMITS.precedents} precedent cases can be cited.`;
  }
  for (const id of draft.precedentIds) {
    if (DISPUTE_ID_PATTERN.test(id) === false) {
      errors.precedentIds = "Precedent case IDs look like MT-00000012-1a2b3c4d.";
      break;
    }
  }
  if (draft.externalUrls.length > APPEAL_LIMITS.externalUrls) {
    errors.externalUrls = `At most ${APPEAL_LIMITS.externalUrls} external sources can be cited.`;
  }
  for (const url of draft.externalUrls) {
    if (url.length > APPEAL_LIMITS.externalUrl) {
      errors.externalUrls = `External source URLs are limited to ${APPEAL_LIMITS.externalUrl} characters.`;
      break;
    }
    if (/^https:\/\//.test(url) === false) {
      errors.externalUrls = "External source URLs must use https://";
      break;
    }
  }
  return errors;
}
