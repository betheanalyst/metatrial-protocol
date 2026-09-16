/**
 * Raw view shapes - exactly as the MetaTrial contracts return them
 * (verified against metatrial_core.py / Phase 0 reconnaissance + live reads).
 * Note: get_dispute() does NOT expose respondent evidence content or
 * evidence summaries - the mapper records that honestly.
 */

export interface DisputeRaw {
  dispute_id: string;
  version: number;
  claimant: string;
  respondent: string;
  participation_deadline: number;
  respondent_participated: boolean;
  title: string;
  category: string;
  dispute_context: string;
  external_ref: string;
  claimant_statement: string;
  claimant_ev_type: string;
  claimant_ev_content: string;
  claimant_ev_hash: string;
  precedent_citations: string;
  external_precedent_urls: string;
  respondent_statement: string;
  respondent_ev_type: string;
  respondent_ev_hash: string;
  status: string;
  appeal_round: number;
  retry_count: number;
  created_at: number;
  last_activity_at: number;
  finalized_at: number;
  has_verdict: boolean;
  max_appeal_rounds_snapshot: number;
  per_party_appeal_cap: number;
  claimant_appeals_used: number;
  respondent_appeals_used: number;
  claimant_appeals_remaining: number;
  respondent_appeals_remaining: number;
  claimant_requested_skip_participation: boolean;
  claimant_requested_skip_appeal: boolean;
  respondent_consented_skip_participation: boolean;
  respondent_consented_skip_appeal: boolean;
  effective_skip_participation: boolean;
  effective_skip_appeal: boolean;
  claimant_agreed_to_resolve: boolean;
  respondent_agreed_to_resolve: boolean;
  attestation_id: string;
}

export interface RecommendedResolutionRaw {
  remedy_type: string;
  remedy_detail: string;
  percentage: number | null;
  conditions: string;
}

export interface VerdictRaw {
  ruling: string;
  ruling_code: number;
  confidence: number;
  primary_finding: string;
  finding_group: string;
  claimant_evidence_quality: string;
  respondent_evidence_quality: string;
  cl_evidence_integrity: boolean;
  resp_evidence_integrity: boolean;
  key_findings: string;
  reasoning_summary: string;
  recommended_resolution: RecommendedResolutionRaw;
  basis_of_determination: string;
  appeal_round: number;
  retry_count: number;
  rendered_at: number;
  raw_finding_verbatim: string;
  raw_remedy_verbatim: string;
  precedents_considered: string;
  external_sources_fetched: string;
  /* get_verdict() extras: */
  dispute_id?: string;
  status?: string;
  is_final?: boolean;
  attestation_id?: string;
  /* get_verdict_history() extra: */
  history_index?: number;
}

export interface AppealEntryRaw {
  appellant: string;
  round_number: number;
  ground_type: string;
  explanation: string;
  specific: string;
  impact: string;
  filed_at: number;
}

export interface AttestationRaw {
  attestation_id: string;
  dispute_id: string;
  ruling: string;
  ruling_code: number;
  confidence: number;
  primary_finding: string;
  finding_group: string;
  remedy_type: string;
  remedy_detail: string;
  appeal_rounds_used: number;
  respondent_participated: boolean;
  cl_evidence_integrity: boolean;
  resp_evidence_integrity: boolean;
  issued_at: number;
  external_ref: string;
  basis_of_determination: string;
  is_revoked: boolean;
  revoke_reason: string;
  is_valid: boolean;
}

/* ---------- Domain models the UI consumes ---------- */

export type ViewerRole = "claimant" | "respondent" | "other";

export interface HumanStatus {
  key: string;
  label: string;
  viewerLabel: string | null;
  description: string;
  tone: "pending" | "active" | "final" | "muted";
}

export interface EvidenceView {
  party: "claimant" | "respondent";
  typeLabel: string;
  content: string | null;
  contentHash: string;
  contentAvailable: boolean;
}

export interface CaseSummary {
  id: string;
  caseNumber: string | null;
  title: string;
  categoryLabel: string;
  status: HumanStatus;
  claimant: string;
  respondent: string;
  createdAt: number;
  respondentParticipated: boolean;
}

export interface CaseDetail extends CaseSummary {
  context: string;
  externalRef: string;
  claimant: string;
  respondent: string;
  lastActivityAt: number;
  finalizedAt: number | null;
  participation: {
    deadline: number;
    participated: boolean;
    requestedSkip: boolean;
    consentedSkip: boolean;
    effectiveSkip: boolean;
  };
  appealWaiver: { requested: boolean; consented: boolean; effective: boolean };
  appealBudget: {
    maxRounds: number;
    perPartyCap: number;
    claimantUsed: number;
    respondentUsed: number;
    claimantRemaining: number;
    respondentRemaining: number;
  };
  mutualResolution: { claimantAgreed: boolean; respondentAgreed: boolean };
  claimantStatement: string;
  respondentStatement: string;
  claimantEvidence: EvidenceView;
  respondentEvidence: EvidenceView;
  precedentCitations: string[];
  externalPrecedentUrls: string[];
  hasVerdict: boolean;
  attestationId: string | null;
}

export interface Determination {
  ruling: string;
  rulingLabel: string;
  rulingCode: number;
  confidence: number;
  primaryFinding: string;
  primaryFindingLabel: string;
  claimantEvidenceQuality: string;
  respondentEvidenceQuality: string;
  claimantIntegrity: boolean;
  respondentIntegrity: boolean;
  keyFindings: string[];
  reasoningSummary: string;
  resolution: {
    remedyType: string;
    remedyLabel: string;
    detail: string;
    percentage: number | null;
    conditions: string;
  };
  basisOfDetermination: string;
  appealRound: number;
  retryCount: number;
  renderedAt: number;
  precedentsConsidered: { disputeId: string }[];
  externalSources: {
    url: string;
    contentHash: string;
    fetchOk: boolean;
    fetchedAt: number;
  }[];
  isCurrent: boolean;
}

export interface AppealEntry {
  appellant: string;
  roundNumber: number;
  groundLabel: string;
  explanation: string;
  specific: string;
  impact: string;
  filedAt: number;
}

export interface Attestation {
  id: string;
  disputeId: string;
  ruling: string;
  rulingLabel: string;
  rulingCode: number;
  confidence: number;
  primaryFindingLabel: string;
  remedyLabel: string;
  remedyDetail: string;
  appealRoundsUsed: number;
  respondentParticipated: boolean;
  claimantIntegrity: boolean;
  respondentIntegrity: boolean;
  issuedAt: number;
  externalRef: string;
  basisOfDetermination: string;
}

export interface RegistryAttestationRaw extends AttestationRaw {
  registry_is_revoked: boolean;
  registry_revoke_reason: string;
}

/**
 * Revocation-aware attestation as reported by the Attestation Registry
 * (the authoritative validity source - Core's own flag can never become
 * true; only the Registry can revoke).
 */
export interface VerifiedAttestation extends Attestation {
  registryRevoked: boolean;
  registryRevokeReason: string;
  isValid: boolean;
}

export interface SettlementRaw {
  settlement_id: string;
  dispute_id: string;
  purpose: string;
  recipient_hex: string;
  amount: number | string;
  claim_status: "AUTHORIZED" | "DELIVERED";
  authorized_at: number;
  delivered_at: number;
  delivered_by_hex: string;
}

export interface Settlement {
  id: string;
  disputeId: string;
  purpose: string;
  purposeLabel: string;
  recipient: string;
  amountWei: bigint;
  claimStatus: "AUTHORIZED" | "DELIVERED";
  authorizedAt: number;
  deliveredAt: number | null;
  deliveredBy: string;
}

export interface ProtocolParamsLike {
  participation_window: number;
  appeal_window: number;
  max_appeal_rounds: number;
  confidence_tolerance: number;
  max_disputes_per_respondent_window: number;
  max_disputes_per_claimant_window: number;
}
