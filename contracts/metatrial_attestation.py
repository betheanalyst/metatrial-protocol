# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

"""
MetaTrial Attestation Registry
================================
Lightweight index contract for MetaTrial Core attestations.

Architecture (Pull Model):
  The registry stores only index mappings: attestation_id, dispute_id,
  external_ref. When attestation data is requested, the registry fetches
  it directly from metatrial_core via gl.contract.get_at() read calls.

  An earlier push-based design (core writing attestation data directly
  into the registry) was replaced because cross-contract writes cannot
  reliably carry the original sender's identity on this platform —
  gl.message.sender_address inside a cross-contract write propagates the
  original EOA, not the calling contract, which breaks auth checks. The
  pull model sidesteps this entirely: core's write to register_finalized()
  carries only three plain strings and needs no auth check, and the
  registry's own reads of core are ordinary, reliable cross-contract
  reads with no sender-identity ambiguity.

  get_finality_status(dispute_id) resolves an ambiguity that
  attestation_exists()/dispute_is_registered()/get_ruling_code() cannot
  on their own — a local index miss can mean "never finalized" or
  "finalized in core but mirror pending/failed," and callers following
  only this registry's local checks have no way to tell which. It falls
  back to a cross-contract read of core's is_dispute_final() view
  exactly once, only on a local miss, returning one of three states:
  INDEXED, FINAL_PENDING_MIRROR, or NOT_FINAL. Core's matching
  retry_mirror() is the recovery path for FINAL_PENDING_MIRROR cases.

Deployment sequence:
  1. Deploy metatrial_core.py         -> CORE_ADDRESS
  2. Deploy metatrial_attestation.py  -> REGISTRY_ADDRESS
  3. registry.set_core_address(CORE_ADDRESS)
  4. core.set_registry_address(REGISTRY_ADDRESS)
  Done. No add_operator() needed.

No AI calls. No fees. Gas only.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
import genlayer as gl
from genlayer.types import *


# ── Constants ─────────────────────────────────────────────────────────────────

MIN_VALID_TIMESTAMP:  int = 1704067200
MAX_EXTERNAL_REF_LEN: int = 128
MAX_REVOKE_REASON:    int = 500

# Ruling codes — must match metatrial_core.py
CODE_CLAIMANT:           int = 0
CODE_RESPONDENT:         int = 1
CODE_SPLIT:              int = 2
CODE_INCONCLUSIVE:       int = 3
CODE_INCONCLUSIVE_FINAL: int = 4


# ── Storage Dataclass ─────────────────────────────────────────────────────────

@gl.storage.allow
@dataclass
class AttestationIndex:
    """
    Minimal index entry stored in the registry.
    Full attestation data lives in metatrial_core and is fetched on demand.
    """
    attestation_id: str
    dispute_id:     str
    external_ref:   str
    registered_at:  u64
    is_revoked:     bool
    revoke_reason:  str


# ── Contract ──────────────────────────────────────────────────────────────────

class MetaTrialAttestationRegistry(gl.contract.Contract):
    """
    MetaTrial Attestation Registry — pull architecture.

    Stores only ID mappings. Fetches full attestation data from core on demand.
    Eliminates cross-contract write auth issues entirely.
    Anyone may read. Only owner may revoke. Registration is permissionless
    (data is already public on core — no confidential information is stored here).
    """

    # Primary index storage
    index: gl.storage.TreeMap[str, AttestationIndex]            # attestation_id → entry
    by_dispute: gl.storage.TreeMap[str, str]                    # dispute_id → attestation_id
    by_external_ref: gl.storage.TreeMap[str, str]               # external_ref → attestation_id

    core_address:       str

    # Access control
    owner:              Address

    # Counters
    total_registered:   u256
    total_revoked:      u256

    def __init__(self) -> None:
        self.owner            = gl.message.sender_address
        self.core_address     = ""
        self.total_registered = u256(0)
        self.total_revoked    = u256(0)

    # ── Internal Utilities ────────────────────────────────────────────────────

    def _require(self, condition: bool, message: str) -> None:
        if not condition:
            raise gl.vm.UserError(message)

    def _get_now(self) -> u64:
        try:
            raw: str = gl.message.raw["datetime"]
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            ts = int(dt.timestamp())
            if ts < MIN_VALID_TIMESTAMP:
                raise gl.vm.UserError(f"ERR:TIMESTAMP_INVALID — {ts}")
            return u64(ts)
        except gl.vm.UserError:
            raise
        except Exception:
            raise gl.vm.UserError("ERR:TIMESTAMP_UNAVAILABLE")

    def _only_owner(self) -> None:
        self._require(
            gl.message.sender_address == self.owner,
            "ERR:NOT_OWNER — restricted to contract owner"
        )

    def _require_core_configured(self) -> None:
        self._require(
            len(self.core_address) >= 10,
            "ERR:CORE_NOT_CONFIGURED — call set_core_address() first"
        )

    # ── Configuration ─────────────────────────────────────────────────────────

    @gl.public.write
    def set_core_address(self, core_addr: str) -> None:
        """
        Set the metatrial_core contract address.
        Called once after both contracts are deployed.
        Registry will fetch attestation data from this address on demand.
        Only callable by owner, and only callable once.

        A re-callable setter would give the owner a permanent, unilateral
        ability to repoint core_address at a different contract at any
        time — including one the owner fully controlled — silently
        substituting fabricated attestation data for every subsequent
        get_attestation()/get_finality_status()/get_ruling_code()
        cross-contract read. This would defeat the "core is the single
        source of truth, this registry only indexes IDs and pulls real
        data from core on demand" trust model the entire pull
        architecture depends on.
        """
        self._require(
            not self.is_core_configured(),
            "ERR:CORE_ALREADY_CONFIGURED — set_core_address is a "
            "one-time-only wiring call and is no longer available; the "
            "core address is now permanent"
        )
        self._only_owner()
        self._require(len(core_addr) >= 10, "ERR:INVALID_CORE_ADDRESS — too short")
        self._require(len(core_addr) <= 128, "ERR:INVALID_CORE_ADDRESS — too long")
        self.core_address = core_addr

    # ── Registration ──────────────────────────────────────────────────────────

    @gl.public.write
    def register_finalized(
        self,
        attestation_id: str,
        dispute_id:     str,
        external_ref:   str,
    ) -> None:
        """
        Register a finalized attestation index entry.

        Permissionless — anyone may call this after a dispute is finalized in core.
        Called automatically by metatrial_core._do_finalize() via cross-contract call.
        Can also be called manually by the claimant/respondent/anyone if the
        automatic call failed (idempotent — safe to call multiple times).

        Duplicate registrations for the same attestation_id are silently
        ignored (idempotent retry — the normal recovery path when an
        earlier automatic or manual call already succeeded).

        This method independently verifies the (attestation_id,
        dispute_id, external_ref) triple against core before accepting
        it, rather than trusting whatever the caller supplies. Without
        this, an attacker could front-run core's own queued registration
        with a fabricated attestation_id for a real dispute_id and
        permanently occupy that dispute_id's slot — a bare
        "reject rebinding an already-indexed key" check alone would then
        also reject core's own legitimate, correct registration when it
        later landed, and because that rejection happens inside core's
        asynchronous emit() dispatch, it would be invisible to
        _do_finalize()'s local try/except and to retry_mirror()'s own
        re-check, which would retry forever, always failing the same
        invisible way.

        Verifying against core closes both problems at once: a call is
        only ever accepted if attestation_id genuinely exists in core
        and its dispute_id (and, if supplied, external_ref) genuinely
        match. A fabricated attestation_id can never pass this check
        regardless of who calls it or when, so there is no race to win —
        whoever's call happens to land first, attacker or core's own
        queued mirror, the same correct data is what gets accepted, and
        a correct call is always idempotent-safe to repeat. This is the
        same "pull, don't push" / "cross-contract writes cannot reliably
        carry sender authority, but a contract reading its own trusted,
        configured dependency always can" discipline this whole protocol
        already applies everywhere else — applied here to the data
        itself rather than to a sender-identity check, since write-based
        sender authority is exactly what this platform does not reliably
        convey.

        The "reject rebinding an already-indexed key" check is retained
        underneath this as defense-in-depth (should be structurally
        unreachable now — core's own invariants mean a dispute is
        finalized exactly once and therefore has exactly one true
        attestation_id, so two different, both core-verified-correct
        attestation_ids should never exist for the same dispute_id — but
        cheap to keep rather than to trust that invariant blindly).
        """
        now = self._get_now()

        # Idempotent: if already registered, do nothing (no error)
        if attestation_id in self.index:
            return

        self._require(
            len(attestation_id) > 0,
            "ERR:ATTESTATION_ID_EMPTY"
        )
        self._require(
            len(dispute_id) > 0,
            "ERR:DISPUTE_ID_EMPTY"
        )
        self._require(
            len(external_ref) <= MAX_EXTERNAL_REF_LEN,
            "ERR:EXTERNAL_REF_TOO_LONG"
        )

        # Verify against core — the authoritative source — before
        # accepting anything the caller supplied. See this method's own
        # docstring for the full reasoning.
        self._require_core_configured()
        core = gl.contract.get_at(Address(self.core_address))
        try:
            core_data = core.view().get_attestation(attestation_id)
        except Exception:
            raise gl.vm.UserError(
                "ERR:ATTESTATION_NOT_VERIFIED — could not verify this "
                "attestation_id against core; it may not exist, or core "
                "could not be reached"
            )
        self._require(
            core_data.get("dispute_id") == dispute_id,
            "ERR:DISPUTE_ID_MISMATCH — core's record of this attestation_id "
            "does not match the supplied dispute_id"
        )
        if external_ref:
            self._require(
                core_data.get("external_ref") == external_ref,
                "ERR:EXTERNAL_REF_MISMATCH — core's record of this "
                "attestation_id does not match the supplied external_ref"
            )

        # Defense-in-depth, retained underneath the core-verification
        # above — see this method's own docstring: reject rebinding an
        # already-indexed dispute_id to a different attestation_id. A
        # caller retrying with the correct (already-registered)
        # attestation_id is unaffected — that path returns early via the
        # idempotency check above and never reaches here.
        self._require(
            dispute_id not in self.by_dispute,
            "ERR:DISPUTE_ALREADY_INDEXED — this dispute_id is already "
            "registered under a different attestation_id; if you believe "
            "that mapping is wrong, this is not the recovery path for it"
        )
        if external_ref:
            self._require(
                external_ref not in self.by_external_ref,
                "ERR:EXTERNAL_REF_ALREADY_INDEXED — this external_ref is "
                "already registered under a different attestation_id"
            )

        entry = AttestationIndex(
            attestation_id = attestation_id,
            dispute_id     = dispute_id,
            external_ref   = external_ref,
            registered_at  = now,
            is_revoked     = False,
            revoke_reason  = "",
        )

        self.index[attestation_id]  = entry
        self.by_dispute[dispute_id] = attestation_id

        if external_ref:
            self.by_external_ref[external_ref] = attestation_id

        # Counts successful registrations — which, permissionless
        # registration being this contract's deliberate design, is not
        # the same claim as "count of verified finalized disputes."
        # This number can still be inflated by anyone submitting
        # distinct fabricated attestation_id/dispute_id pairs, just no
        # longer by rebinding entries that already point at something
        # real. See get_registry_info()'s own docstring.
        self.total_registered = u256(int(self.total_registered) + 1)

    @gl.public.write
    def revoke_attestation(self, attestation_id: str, reason: str) -> None:
        """
        Emergency revocation — marks index entry as revoked.
        Only callable by owner. Does not affect core storage.
        The revocation is registry-layer only (for composability blacklisting).

        DESIGN NOTE: revocation here is permanent — there is no
        un-revoke method, and `owner` has no rotation or transfer
        mechanism anywhere in this contract, so a lost owner key
        permanently and irrecoverably disables this method entirely.
        Both properties are intentional protocol-governance decisions:
        permanent, single-key-gated revocation is a legitimate design
        choice some protocols make deliberately to minimize
        administrative surface, and whether it should instead be
        reversible or multisig-gated is a governance question about this
        contract's risk tolerance, not a correctness requirement this
        contract violates as implemented.
        """
        self._only_owner()
        self._require(attestation_id in self.index, "ERR:NOT_INDEXED")
        entry = self.index[attestation_id]
        self._require(not entry.is_revoked, "ERR:ALREADY_REVOKED")
        self._require(
            len(reason) > 0 and len(reason) <= MAX_REVOKE_REASON,
            "ERR:REASON_REQUIRED"
        )
        entry.is_revoked    = True
        entry.revoke_reason = reason[:MAX_REVOKE_REASON]
        self.index[attestation_id] = entry
        self.total_revoked = u256(int(self.total_revoked) + 1)

    # ── Public View Methods ───────────────────────────────────────────────────

    @gl.public.view
    def get_core_address(self) -> str:
        """Return the configured core contract address."""
        return self.core_address

    @gl.public.view
    def is_core_configured(self) -> bool:
        """True if set_core_address() has been called."""
        return len(self.core_address) >= 10

    @gl.public.view
    def attestation_exists(self, attestation_id: str) -> bool:
        """
        Check if an attestation_id has been registered in this registry's
        local index only. A False return does not distinguish "the
        dispute isn't finalized yet" from "it's finalized in core but the
        mirror hasn't landed" — use get_finality_status() (by dispute_id)
        for that distinction.
        """
        return attestation_id in self.index

    @gl.public.view
    def dispute_is_registered(self, dispute_id: str) -> bool:
        """
        Check if a dispute_id has been registered in this registry's
        local index only. Same local-only caveat as attestation_exists()
        above — use get_finality_status() for the full tri-state picture.
        """
        return dispute_id in self.by_dispute

    @gl.public.view
    def get_attestation_id_for_dispute(self, dispute_id: str) -> str:
        """
        Returns the attestation_id for a dispute_id.
        Returns empty string if not registered.
        """
        return self.by_dispute.get(dispute_id, "")

    @gl.public.view
    def get_finality_status(self, dispute_id: str) -> dict:
        """
        Resolves the ambiguity that attestation_exists(),
        dispute_is_registered(), and get_ruling_code() alone cannot —
        distinguishing three states for a dispute_id:

          "INDEXED"              — already mirrored into this registry.
          "FINAL_PENDING_MIRROR" — finalized in core, but the mirror has
                                    not (yet, or successfully) landed
                                    here. Core's retry_mirror() is the
                                    recovery path.
          "NOT_FINAL"            — not yet finalized in core at all.

        On a local index miss, falls back to a cross-contract read to
        core's existing is_dispute_final() view — no schema change to
        the index, and no new write path from core into this registry
        beyond the one that already exists. This is the same pull-model
        precedent this registry's entire architecture is already built
        on, applied to a read-time ambiguity instead of a write-time one.

        An external integrator following the two-step pattern (check
        core.is_dispute_final(), then registry.get_ruling_code()) can
        call this single method instead and get the same information in
        one cross-contract round trip rather than two.
        """
        if dispute_id in self.by_dispute:
            return {
                "status":         "INDEXED",
                "attestation_id": self.by_dispute[dispute_id],
            }
        self._require_core_configured()
        core = gl.contract.get_at(Address(self.core_address))
        # Fail toward the more conservative status if this cross-contract
        # call itself throws (e.g. core_address misconfigured or
        # pointing at an incompatible contract) — "cannot confirm
        # finality" is treated as NOT_FINAL rather than letting a raw
        # exception propagate.
        try:
            is_final = core.view().is_dispute_final(dispute_id)
        except Exception:
            is_final = False
        if is_final:
            return {"status": "FINAL_PENDING_MIRROR", "attestation_id": ""}
        else:
            return {"status": "NOT_FINAL", "attestation_id": ""}

    @gl.public.view
    def get_index_entry(self, attestation_id: str) -> dict:
        """
        Returns the registry index entry (IDs and revocation status only).
        Does not fetch full attestation data from core. Only meaningful
        for an attestation_id already known to be indexed — if you only
        have a dispute_id and don't yet know whether it's indexed, call
        get_finality_status() first.
        Use get_attestation() for full data.
        """
        self._require(attestation_id in self.index, "ERR:NOT_INDEXED")
        e = self.index[attestation_id]
        return {
            "attestation_id": e.attestation_id,
            "dispute_id":     e.dispute_id,
            "external_ref":   e.external_ref,
            "registered_at":  int(e.registered_at),
            "is_revoked":     e.is_revoked,
            "revoke_reason":  e.revoke_reason,
        }

    @gl.public.view
    def get_attestation(self, attestation_id: str) -> dict:
        """
        Full attestation data fetched from metatrial_core.
        Registry reads from core on demand — single source of truth.
        Returns core's get_attestation() dict plus registry revocation status.
        """
        self._require_core_configured()
        self._require(attestation_id in self.index, "ERR:NOT_INDEXED")
        entry = self.index[attestation_id]

        core = gl.contract.get_at(Address(self.core_address))
        # Converted to a clean, ERR:-prefixed failure rather than letting
        # a raw exception propagate. Unlike get_finality_status()'s
        # boolean check, this method's entire purpose is returning full
        # attestation data — there is no safe, non-misleading placeholder
        # dict to fall back to here, so the caller gets an explicit,
        # actionable error instead of either a raw platform exception or
        # fabricated data.
        try:
            core_data = core.view().get_attestation(attestation_id)
        except Exception:
            raise gl.vm.UserError(
                "ERR:CORE_READ_FAILED — could not fetch attestation data "
                "from the configured core contract"
            )

        core_data["registry_is_revoked"] = entry.is_revoked
        core_data["registry_revoke_reason"] = entry.revoke_reason
        core_data["is_valid"] = (
            not core_data.get("is_revoked", False) and not entry.is_revoked
        )
        return core_data

    @gl.public.view
    def get_attestation_by_dispute(self, dispute_id: str) -> dict:
        """
        Fetch full attestation data by dispute_id.
        Looks up attestation_id in index, then pulls data from core.
        """
        self._require(dispute_id in self.by_dispute, "ERR:DISPUTE_NOT_INDEXED")
        return self.get_attestation(self.by_dispute[dispute_id])

    @gl.public.view
    def get_attestation_by_external_ref(self, external_ref: str) -> dict:
        """
        Fetch full attestation data by platform-supplied external case ID.
        """
        self._require(external_ref in self.by_external_ref, "ERR:EXTERNAL_REF_NOT_FOUND")
        return self.get_attestation(self.by_external_ref[external_ref])

    @gl.public.view
    def verify(self, attestation_id: str) -> bool:
        """
        Boolean validity check.
        Returns True if attestation is indexed and not revoked at registry level.
        Does not check core revocation status (use get_attestation() for full check).
        For a quick indexed existence + registry-revocation check.
        """
        if attestation_id not in self.index:
            return False
        return not self.index[attestation_id].is_revoked

    @gl.public.view
    def get_ruling_code(self, dispute_id: str) -> int:
        """
        Integer ruling code for programmatic external consumption.
        Fetches from core. Returns -1 if not indexed or core read fails —
        this -1 is deliberately ambiguous between "never finalized" and
        "finalized but mirror pending/failed"; call get_finality_status()
        first if that distinction matters to the caller.
        Codes: 0=CLAIMANT, 1=RESPONDENT, 2=SPLIT, 3=INCONCLUSIVE, 4=INCONCLUSIVE_FINAL
        """
        if dispute_id not in self.by_dispute:
            return -1
        attestation_id = self.by_dispute[dispute_id]
        if self.index[attestation_id].is_revoked:
            return -1
        if len(self.core_address) < 10:
            return -1
        core = gl.contract.get_at(Address(self.core_address))
        # Catches a core-read failure so it returns the documented -1
        # rather than letting a raw exception propagate.
        try:
            return core.view().get_ruling_code(dispute_id)
        except Exception:
            return -1

    @gl.public.view
    def get_registry_info(self) -> dict:
        """
        Registry statistics and configuration.

        total_registered counts successful calls to register_finalized(),
        not verified finalized disputes — registration is deliberately
        permissionless (this registry's core design: core is the data
        authority, this contract only indexes IDs), so this number can
        be inflated by anyone submitting distinct fabricated
        attestation_id/dispute_id pairs at no cost. A caller wanting a
        trustworthy count of real finalized disputes must independently
        verify each entry against core (e.g. via get_attestation()), not
        rely on this statistic alone.
        """
        return {
            "owner":             self.owner.as_hex,
            "core_address":      self.core_address,
            "core_configured":   len(self.core_address) >= 10,
            "total_registered":  int(self.total_registered),
            "total_revoked":     int(self.total_revoked),
            "architecture":      "pull-v7",
        }
