import type {
  AppealEntry,
  AppealEntryRaw,
  Attestation,
  AttestationRaw,
  CaseDetail,
  CaseSummary,
  Determination,
  EvidenceView,
  VerdictRaw,
} from "./types";
import {
  appealGroundLabel,
  categoryLabel,
  evidenceQualityLabel,
  evidenceTypeLabel,
  findingLabel,
  humanStatus,
  remedyLabel,
  rulingLabel,
} from "./labels";
import type { DisputeRaw } from "./types";

/**
 * Explicit mappers from raw contract views to typed domain models -
 * the only place raw shapes are interpreted (foundation specification,
 * integration boundary).
 */

export function parseDisputeId(disputeId: string): string | null {
  // Format: MT-{counter:08d}-{claimantHexSuffix8}
  const match = disputeId.match(/^MT-(\d{8})-[0-9a-fA-F]{8}$/);
  if (match === null) {
    return null;
  }
  return String(Number.parseInt(match[1], 10));
}

export function parseKeyFindings(keyFindingsJson: string): string[] {
  if (keyFindingsJson === "" || keyFindingsJson === undefined || keyFindingsJson === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(keyFindingsJson);
    if (typeof parsed !== "object" || parsed === null) {
      return [];
    }
    const record = parsed as Record<string, unknown>;
    const findings: string[] = [];
    for (const key of ["f1", "f2", "f3"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim() !== "") {
        findings.push(value);
      }
    }
    return findings;
  } catch {
    return [];
  }
}

export function parsePrecedentsConsidered(json: string): { disputeId: string }[] {
  if (json === "" || json === undefined || json === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) === false) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
      .map((entry) => ({ disputeId: String(entry.dispute_id ?? "") }))
      .filter((entry) => entry.disputeId !== "");
  } catch {
    return [];
  }
}

export function parseExternalSources(
  json: string,
): { url: string; contentHash: string; fetchOk: boolean; fetchedAt: number }[] {
  if (json === "" || json === undefined || json === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) === false) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
      .map((entry) => ({
        url: String(entry.url ?? ""),
        contentHash: String(entry.content_hash ?? ""),
        fetchOk: entry.fetch_ok === true,
        fetchedAt: typeof entry.fetched_at === "number" ? entry.fetched_at : 0,
      }))
      .filter((entry) => entry.url !== "");
  } catch {
    return [];
  }
}

export function splitCitations(citations: string): string[] {
  if (citations === "" || citations === undefined || citations === null) {
    return [];
  }
  return citations.split(",").filter((entry) => entry.trim() !== "");
}

export function splitExternalUrls(urls: string): string[] {
  if (urls === "" || urls === undefined || urls === null) {
    return [];
  }
  return urls.split("\n").filter((entry) => entry.trim() !== "");
}

function toEvidenceView(
  party: "claimant" | "respondent",
  type: string,
  content: string | null,
  contentHash: string,
): EvidenceView {
  return {
    party,
    typeLabel: evidenceTypeLabel(type),
    content,
    contentHash,
    contentAvailable: content !== null && content !== "",
  };
}

export function toCaseSummary(raw: DisputeRaw): CaseSummary {
  return {
    id: raw.dispute_id,
    caseNumber: parseDisputeId(raw.dispute_id),
    title: raw.title,
    categoryLabel: categoryLabel(raw.category),
    status: humanStatus(raw.status),
    claimant: raw.claimant,
    respondent: raw.respondent,
    createdAt: raw.created_at,
    respondentParticipated: raw.respondent_participated,
  };
}

export function toCaseDetail(raw: DisputeRaw): CaseDetail {
  return {
    ...toCaseSummary(raw),
    context: raw.dispute_context,
    externalRef: raw.external_ref,
    lastActivityAt: raw.last_activity_at,
    finalizedAt: raw.finalized_at > 0 ? raw.finalized_at : null,
    participation: {
      deadline: raw.participation_deadline,
      participated: raw.respondent_participated,
      requestedSkip: raw.claimant_requested_skip_participation,
      consentedSkip: raw.respondent_consented_skip_participation,
      effectiveSkip: raw.effective_skip_participation,
    },
    appealWaiver: {
      requested: raw.claimant_requested_skip_appeal,
      consented: raw.respondent_consented_skip_appeal,
      effective: raw.effective_skip_appeal,
    },
    appealBudget: {
      maxRounds: raw.max_appeal_rounds_snapshot,
      perPartyCap: raw.per_party_appeal_cap,
      claimantUsed: raw.claimant_appeals_used,
      respondentUsed: raw.respondent_appeals_used,
      claimantRemaining: raw.claimant_appeals_remaining,
      respondentRemaining: raw.respondent_appeals_remaining,
    },
    mutualResolution: {
      claimantAgreed: raw.claimant_agreed_to_resolve,
      respondentAgreed: raw.respondent_agreed_to_resolve,
    },
    claimantStatement: raw.claimant_statement,
    respondentStatement: raw.respondent_statement,
    claimantEvidence: toEvidenceView(
      "claimant",
      raw.claimant_ev_type,
      raw.claimant_ev_content,
      raw.claimant_ev_hash,
    ),
    respondentEvidence: toEvidenceView(
      "respondent",
      raw.respondent_ev_type,
      null,
      raw.respondent_ev_hash,
    ),
    precedentCitations: splitCitations(raw.precedent_citations),
    externalPrecedentUrls: splitExternalUrls(raw.external_precedent_urls),
    hasVerdict: raw.has_verdict,
    attestationId: raw.attestation_id === "" ? null : raw.attestation_id,
  };
}

export function toDetermination(raw: VerdictRaw, isCurrent: boolean): Determination {
  return {
    ruling: raw.ruling,
    rulingLabel: rulingLabel(raw.ruling),
    rulingCode: raw.ruling_code,
    confidence: raw.confidence,
    primaryFinding: raw.primary_finding,
    primaryFindingLabel: findingLabel(raw.primary_finding),
    claimantEvidenceQuality: evidenceQualityLabel(raw.claimant_evidence_quality),
    respondentEvidenceQuality: evidenceQualityLabel(raw.respondent_evidence_quality),
    claimantIntegrity: raw.cl_evidence_integrity,
    respondentIntegrity: raw.resp_evidence_integrity,
    keyFindings: parseKeyFindings(raw.key_findings),
    reasoningSummary: raw.reasoning_summary,
    resolution: {
      remedyType: raw.recommended_resolution.remedy_type,
      remedyLabel: remedyLabel(raw.recommended_resolution.remedy_type),
      detail: raw.recommended_resolution.remedy_detail,
      percentage: raw.recommended_resolution.percentage,
      conditions: raw.recommended_resolution.conditions,
    },
    basisOfDetermination: raw.basis_of_determination,
    appealRound: raw.appeal_round,
    retryCount: raw.retry_count,
    renderedAt: raw.rendered_at,
    precedentsConsidered: parsePrecedentsConsidered(raw.precedents_considered),
    externalSources: parseExternalSources(raw.external_sources_fetched),
    isCurrent,
  };
}

export function toAppealEntry(raw: AppealEntryRaw): AppealEntry {
  return {
    appellant: raw.appellant,
    roundNumber: raw.round_number,
    groundLabel: appealGroundLabel(raw.ground_type),
    explanation: raw.explanation,
    specific: raw.specific,
    impact: raw.impact,
    filedAt: raw.filed_at,
  };
}

export function toAttestation(raw: AttestationRaw): Attestation {
  return {
    id: raw.attestation_id,
    disputeId: raw.dispute_id,
    ruling: raw.ruling,
    rulingLabel: rulingLabel(raw.ruling),
    rulingCode: raw.ruling_code,
    confidence: raw.confidence,
    primaryFindingLabel: findingLabel(raw.primary_finding),
    remedyLabel: remedyLabel(raw.remedy_type),
    remedyDetail: raw.remedy_detail,
    appealRoundsUsed: raw.appeal_rounds_used,
    respondentParticipated: raw.respondent_participated,
    claimantIntegrity: raw.cl_evidence_integrity,
    respondentIntegrity: raw.resp_evidence_integrity,
    issuedAt: raw.issued_at,
    externalRef: raw.external_ref,
    basisOfDetermination: raw.basis_of_determination,
  };
}

export function toVerifiedAttestation(
  raw: import("./types").RegistryAttestationRaw,
): import("./types").VerifiedAttestation {
  return {
    ...toAttestation(raw),
    registryRevoked: raw.registry_is_revoked,
    registryRevokeReason: raw.registry_revoke_reason,
    isValid: raw.is_valid === true,
  };
}

export function toSettlement(raw: import("./types").SettlementRaw): import("./types").Settlement {
  return {
    id: raw.settlement_id,
    disputeId: raw.dispute_id,
    purpose: raw.purpose,
    purposeLabel: settlementPurposeLabel(raw.purpose),
    recipient: raw.recipient_hex,
    amountWei: toBigIntSafeValue(raw.amount),
    claimStatus: raw.claim_status,
    authorizedAt: raw.authorized_at,
    deliveredAt: raw.delivered_at > 0 ? raw.delivered_at : null,
    deliveredBy: raw.delivered_by_hex,
  };
}

function settlementPurposeLabel(purpose: string): string {
  if (purpose === "FILING_FEE_FORFEITURE") {
    return "Filing fee forfeiture";
  }
  if (purpose === "APPEAL_BOND_REFUND") {
    return "Appeal bond refund";
  }
  if (purpose === "APPEAL_BOND_FORFEITURE") {
    return "Appeal bond forfeiture";
  }
  return purpose;
}

function toBigIntSafeValue(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }
  return BigInt(String(value));
}
