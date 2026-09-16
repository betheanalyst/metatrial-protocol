# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

"""
MetaTrial Governance
=======================
Standalone administration contract for the MetaTrial protocol.

BOOTSTRAP:
  - A single deployer becomes the sole admin at deploy time.
  - Exactly once, that sole admin may add a second admin directly via
    add_admin() -- no proposal, no approval window, no timelock,
    immediate execution. This is the bootstrap exception, not a
    governance action.
  - The instant the second admin is added, bootstrap is permanently
    complete (a one-way flag, never reset). From that point on,
    admin-set changes require the full multisig + timelock proposal
    flow below.
  - transfer_admin_seat() remains a narrow, bootstrap-phase-only safety
    valve, permanently disabled the instant bootstrap completes.

MULTISIG PROPOSAL SYSTEM:
  A full propose/approve/timelock/execute state machine for seven
  action types: ADD_ADMIN, REMOVE_ADMIN, CORE_PARAM_UPDATE, PAUSE,
  UNPAUSE, TREASURY_UPDATE, and EXTERNAL_SOURCE_UPDATE.

    - Fixed threshold table -- 2 admins needs 2 approvals, 3 needs 2,
      4 needs 3, 5 needs 3. A hardcoded dict, not a derived formula, and
      not governance-adjustable by any proposal.
    - Proposer's creation act is their own implicit first approval --
      they may never additionally call approve() on their own proposal.
    - Dual validation: every action is checked both at proposal creation
      ("would this be valid if executed right now?") and again at
      execution time ("is this still valid given current state?"),
      using the admin count and target state as they exist at each
      check, never a value frozen from an earlier moment.
    - Approval validity tracks live admin membership: an approval given
      by an address that is no longer an active admin by the time of
      any subsequent check does not count toward the threshold.
    - Exactly-once execution: execute() explicitly rejects any call
      against an already-EXECUTED or already-EXPIRED proposal --
      governance actions have unique, non-idempotent side effects and
      must never be reapplied.
    - Permissionless execution trigger: any address, not only admins,
      may call execute() once a proposal's timelock has elapsed --
      avoiding a liveness bottleneck where every admin assumes someone
      else will trigger it.

GOVERNANCE AUTHORIZES, CORE APPLIES:
  "Governance may authorize protocol changes but shall never directly
  own or mutate arbitration state." CORE_PARAM_UPDATE proposals, once
  EXECUTED, are nothing more than an immutable, multisig-approved,
  timelocked authorization record -- this contract makes no
  cross-contract call to metatrial_core.py anywhere, ever. Core alone
  owns its protocol parameters, its own pending/timelock storage, and
  the authoritative decision of when and whether to apply an authorized
  change. Core's apply_governance_action() method reads this contract's
  get_proposal() via a cross-contract read that Core itself initiates
  (the same pull-model precedent the Attestation Registry uses, for the
  same reason: cross-contract writes cannot reliably carry sender
  authority on this platform, but a contract reading its own trusted,
  configured dependency always can). This keeps ownership boundaries
  clean, keeps parameter snapshots local to Core, and minimizes
  cross-contract coupling to a single, well-understood read.

EMERGENCY PAUSE: ACTION_PAUSE/ACTION_UNPAUSE go through the exact same
  multisig + timelock flow as every other action type here -- no fast
  path for either direction, deliberately: a pause mechanism a single
  compromised key could trigger would be a bigger risk than the
  incidents it exists to contain, and an attacker who could bypass
  deliberation to unpause would defeat the pause's purpose just as much
  as one who could trigger it. `paused` lives here, in Governance --
  this is Governance mutating its own storage, not Core's, so it does
  not conflict with the invariant above. Core's submit_dispute() reads
  this via a cross-contract view() call (the only method it gates --
  never finalize()/file_appeal()/retry_mirror(), so a pause can never
  trap an in-flight dispute). pending_proposal_count is a maintained
  O(1) counter (incremented at proposal creation, decremented at all
  four terminal-transition sites), read by Core's get_protocol_health().

TREASURY_UPDATE: authorizes metatrial_core.py's dispute_filing_fee/
  appeal_bond_amount/treasury_address -- see that file's own Settlement
  Interface docstring for the full architecture. Same multisig +
  timelock mechanism as every other action type; no relayer address
  exists anywhere in this contract (see Core's docstring for why).

EXTERNAL_SOURCE_UPDATE: manages external_precedent_sources:
  TreeMap[str, bool] -- whitelisted URL prefix -> active. Same multisig
  + timelock mechanism as every other action type;
  propose_external_source_update(source_prefix, active) is the single
  entry point for both adding/activating a prefix and deactivating one
  (active=False), rather than two near-duplicate methods, since the
  underlying state transition is symmetric (set this prefix's flag to
  this value) the same way PAUSE/UNPAUSE are two methods but one shared
  mechanism.

  Unlike CORE_PARAM_UPDATE/TREASURY_UPDATE (Governance authorizes, Core
  applies its own copy), this whitelist follows the `paused` pattern
  instead: Governance owns and mutates this configuration directly, in
  its own storage, the instant a proposal reaches EXECUTED -- there is
  no corresponding Core-side apply step, because Core never stores a
  copy of the whitelist at all. Core cross-contract-reads it,
  per-citation, via the is_external_source_active(url) view -- the same
  pull-model role is_paused() already plays for submit_dispute(). This
  keeps the "Governance authorizes, Core applies" invariant intact: Core
  is still never told what to do by a write from this contract, only by
  reading this contract's own, independently-owned state.

  target_hex -- generically named after its original ADD_ADMIN/
  REMOVE_ADMIN use as an admin's hex address -- is reused here to hold
  the whitelisted URL prefix string instead (same tagged-union
  rationale as every other action type's reuse of this record's generic
  fields: a second dataclass for one more action type would duplicate
  the entire proposal/approval/threshold machinery this one already
  supports generically). The one new field this action type needed,
  param_external_source_active, is populated only for
  EXTERNAL_SOURCE_UPDATE and stays False for every other type.

  Prefix format is validated at proposal-creation and -execution time
  (the same dual-validation every action type gets): non-empty,
  length-capped, and required to start with "https://" -- a real,
  restrictive scheme requirement, not a cosmetic one, since
  is_external_source_active()'s prefix-match logic gives any string
  starting with an active entry a green light, and a non-https prefix
  (or an empty one) would make that match trivially, unacceptably
  broad. Proposing to set a prefix to the state it's already in
  (already-active->activate, or already-inactive/never-seen->deactivate)
  is rejected as a no-op at both validation checkpoints, mirroring
  PAUSE/UNPAUSE's own "would this be valid right now" self-state check.

Deliberately not included in this file:
  - No enumeration/pagination view over external_precedent_sources
    (contrast get_admins() for the admins TreeMap). This covers
    management and citation-time membership checking, not a browsable
    listing, and GenLayer's TreeMap has no native key-enumeration
    primitive without a maintained companion list (the same reason
    admin_list exists alongside admins).

Admin membership representation:
  Live admin membership is a boolean flag in `admins`, always accessed
  through the single centralized `_is_active_admin()` helper -- never a
  bare `in` check -- because GenLayer's TreeMap has no documented
  deletion primitive. `admin_list` is an append-only historical record
  of every address ever granted a seat, used only for enumeration
  (get_admins()); it is never used, by itself, to determine current
  membership.

Proposal/approval storage shape:
  Following the same top-level `TreeMap[key, TreeMap[index, Record]]`
  convention already established in metatrial_core.py's appeal_log
  (never a DynArray field inside an @allow_storage @dataclass, which
  the GenLayer runtime cannot instantiate): `proposals` is a flat
  TreeMap[str, ProposalRecord]; `approvals` is
  TreeMap[str, TreeMap[str, bool]], populated via
  `get_or_insert_default()` exactly as metatrial_core.py's own
  `_index_dispute_for_party()` already does for its nested TreeMaps.

No AI calls. No fees. Gas only, in this version.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
import genlayer as gl
from genlayer.types import *


# ── Constants ─────────────────────────────────────────────────────────────────

MIN_VALID_TIMESTAMP: int = 1704067200

# Fixed, never governance-adjustable. Admin count 1 has no entry:
# bootstrap only, never reaches the proposal system below.
THRESHOLD_TABLE: dict = {2: 2, 3: 2, 4: 3, 5: 3}

MAX_ADMINS:                int = 5

# Floor of 3, not 2. At a floor of 2, losing a single admin's key was an
# unrecoverable lockout — reaching 3 (the only way to then remove the
# dead key) itself required 2-of-2 approval, which the dead key made
# impossible to ever obtain. At a floor of 3, losing one admin still
# leaves 2 live signers, meeting THRESHOLD_TABLE's 2-of-3 requirement to
# add a replacement (after which the dead key can be removed once back
# at 4). Two or more admins going dark simultaneously at a floor of 3
# remains an unrecoverable lockout in the same way, accepted as residual
# risk given its much lower probability than the single-failure case a
# floor of 2 was exposed to.
#
# This constant governs only when removal is blocked — it does not, and
# structurally cannot, prevent the brief post-bootstrap window where
# active_admin_count is legitimately 2 (bootstrap itself only ever
# reaches 2 admins; THRESHOLD_TABLE therefore still has a valid entry
# for 2). Reaching 3 admins promptly after bootstrap completes is a
# strongly recommended operational practice, not something this contract
# enforces on its own.
MIN_ADMINS_POST_BOOTSTRAP: int = 3

# Fixed durations, never governance-adjustable, for the same reason the
# threshold table isn't.
APPROVAL_WINDOW_SECONDS: int = 86400   # 24h
TIMELOCK_SECONDS:        int = 86400   # 24h, matches core's PARAM_TIMELOCK

ACTION_ADD_ADMIN:        str = "ADD_ADMIN"
ACTION_REMOVE_ADMIN:     str = "REMOVE_ADMIN"
ACTION_CORE_PARAM_UPDATE: str = "CORE_PARAM_UPDATE"
ACTION_PAUSE:            str = "PAUSE"
ACTION_UNPAUSE:          str = "UNPAUSE"
ACTION_TREASURY_UPDATE:  str = "TREASURY_UPDATE"
ACTION_EXTERNAL_SOURCE_UPDATE: str = "EXTERNAL_SOURCE_UPDATE"

# Sanity bounds for economic parameters. Deliberately generous (this
# contract has no confirmed knowledge of GEN's real-world value or
# decimals) — the purpose is to reject obviously-wrong proposals (e.g. a
# fat-fingered extra zero), not to encode a specific intended fee level.
# Core's own _validate_treasury_params() mirrors these exactly and is
# the authoritative check.
DISPUTE_FILING_FEE_MAX: int = 10**24
APPEAL_BOND_AMOUNT_MAX: int = 10**24

# Mirrors metatrial_core.py's own propose_parameter_update() bounds
# exactly. Kept in sync by convention across files, the same way
# _get_now()/_require() are duplicated verbatim across every contract in
# this protocol rather than shared — GenLayer contracts cannot import
# code from one another. Governance validates against these bounds at
# proposal-creation time as a defense-in-depth check (per "Governance
# authorizes, Core applies" -- Core re-validates independently and
# authoritatively when it applies the action; Governance's check here
# exists only so an out-of-range proposal is rejected immediately rather
# than accepted and only discovered invalid much later at apply time).
PARTICIPATION_WINDOW_MIN: int = 3600
PARTICIPATION_WINDOW_MAX: int = 604800
APPEAL_WINDOW_MIN:        int = 3600
APPEAL_WINDOW_MAX:        int = 604800
MAX_APPEAL_ROUNDS_MIN:    int = 1
MAX_APPEAL_ROUNDS_MAX:    int = 5
CONFIDENCE_TOLERANCE_MIN: int = 5
CONFIDENCE_TOLERANCE_MAX: int = 30
MAX_DISPUTES_PER_RESPONDENT_MIN: int = 1
MAX_DISPUTES_PER_RESPONDENT_MAX: int = 100
MAX_DISPUTES_PER_CLAIMANT_MIN:   int = 1
MAX_DISPUTES_PER_CLAIMANT_MAX:   int = 200

# Sanity bounds for external precedent source prefixes. A real,
# restrictive scheme requirement (not cosmetic) — see the module
# docstring's EXTERNAL_SOURCE_UPDATE section for why "https://"
# specifically. MIN_EXTERNAL_SOURCE_PREFIX_LEN rejects a bare
# "https://" (8 chars) or near-bare "https://x/" style prefix that would
# authorize an unreasonably broad — or, in the bare case, literally
# unbounded — set of URLs. 12 is the shortest length that can hold
# scheme (8) + a minimal-but-real two-label hostname like "a.b" (3) +
# the now-mandatory trailing "/" (1) = 12.
MIN_EXTERNAL_SOURCE_PREFIX_LEN:  int = 12
MAX_EXTERNAL_SOURCE_PREFIX_LEN:  int = 200
REQUIRED_EXTERNAL_SOURCE_SCHEME: str = "https://"

# Canonical zero-address hex, lowercased to match every other
# stored/compared hex string's own convention in this file. Used
# specifically to reject it as a treasury destination in
# ACTION_TREASURY_UPDATE validation — mirrors metatrial_core.py's own
# identical constant and check.
ZERO_ADDRESS_HEX: str = "0x0000000000000000000000000000000000000000"

STATUS_PENDING_APPROVALS: str = "PENDING_APPROVALS"
STATUS_TIMELOCKED:        str = "TIMELOCKED"
STATUS_EXECUTED:          str = "EXECUTED"
STATUS_EXPIRED:           str = "EXPIRED"


# ── Storage Dataclass ─────────────────────────────────────────────────────────

@gl.storage.allow
@dataclass
class ProposalRecord:
    """
    A single governance proposal. Seven action types exist — ADD_ADMIN,
    REMOVE_ADMIN, CORE_PARAM_UPDATE, PAUSE, UNPAUSE, TREASURY_UPDATE, and
    EXTERNAL_SOURCE_UPDATE.

    threshold_reached_at and ready_at are 0 until the corresponding
    transition occurs, then immutable — recorded once. The required-
    approval threshold itself is never stored on the record: it is
    always recomputed live from the current active_admin_count at the
    moment of each check, so a stored, possibly-stale threshold value
    can never be read by mistake.

    The ten param_* fields are populated only for the action type(s)
    that use them and remain 0/""/False otherwise — a small, explicit
    tagged-union shape rather than a separate record type per action,
    since introducing a second dataclass (and a second top-level TreeMap
    to store it in) for each additional action type would duplicate the
    entire proposal/approval/threshold machinery this record already
    supports generically. ADD_ADMIN/REMOVE_ADMIN/PAUSE/UNPAUSE use none
    of them (their target_hex or action_type alone is fully self-
    describing); CORE_PARAM_UPDATE uses the first six;
    TREASURY_UPDATE uses the next three; EXTERNAL_SOURCE_UPDATE uses
    param_external_source_active alone (and reuses target_hex, not a
    param_* field, for the whitelisted prefix itself — see the module
    docstring's EXTERNAL_SOURCE_UPDATE section).
    """
    proposal_id:          str
    action_type:          str
    target_hex:           str
    proposer_hex:         str
    created_at:           u64
    expires_at:           u64
    threshold_reached_at: u64
    ready_at:             u64
    status:               str
    param_participation_window:             u256
    param_appeal_window:                    u256
    param_max_appeal_rounds:                u256
    param_confidence_tolerance:              u256
    param_max_disputes_per_respondent_window: u256
    # 6th parameter, bundled into the existing CORE_PARAM_UPDATE action
    # type (same category as the five above — arbitration/rate-limit
    # timing, not economic/settlement — so it follows that type's "all
    # parameters specified together" convention rather than a separate
    # action type).
    param_max_disputes_per_claimant_window: u256

    # Populated only for TREASURY_UPDATE proposals; 0/"" for every other
    # action type. Same tagged-union rationale as the five param_*
    # fields above — a second dataclass for one more action type would
    # duplicate the entire proposal/approval/threshold machinery this
    # record already supports generically.
    #
    # Deliberately no relayer_address field: delivery (metatrial_core.py's
    # claim_settlement()) is itself permissionless and on-chain — no
    # address has any privileged delivery role for Governance to
    # configure or authorize in the first place (see metatrial_core.py's
    # Settlement interface docstring for the current architecture).
    param_dispute_filing_fee: u256
    param_appeal_bond_amount: u256
    param_treasury_address:   str

    # Populated only for EXTERNAL_SOURCE_UPDATE proposals; False for
    # every other action type. Same tagged-union rationale as every
    # param_* field above. target_hex (the generic string field every
    # action type already carries) holds the whitelisted URL prefix for
    # this action type — see the module docstring's
    # EXTERNAL_SOURCE_UPDATE section for why reusing it, rather than
    # adding a second string field, is consistent with this record's
    # existing convention.
    param_external_source_active: bool


# ── Contract ──────────────────────────────────────────────────────────────────

class MetaTrialGovernance(gl.contract.Contract):
    """
    MetaTrial Governance — bootstrap admin seat plus a multisig proposal
    system for admin-set and protocol-parameter changes.

    Storage justification, field by field:
      admins            — live admin membership, boolean flag per hex
                         address. See _is_active_admin()'s own comment
                         for why membership is never a bare `in` check.
      admin_list        — append-only historical record of every address
                         ever granted a seat, used only for enumeration.
      active_admin_count — maintained counter, not derived by iterating
                         admins.
      bootstrap_complete — one-way flag, set True the instant the second
                         admin is added, never reset.
      proposals        — one record per proposal, keyed by proposal_id.
                         Required to persist the state machine across
                         the multi-transaction propose/approve/execute
                         lifecycle; cannot live only in memory since each
                         step is a separate transaction.
      approvals        — one boolean-flag submap per proposal, keyed by
                         approving admin's hex address. Required to
                         enforce "each admin approves at most once" and
                         "approval validity tracks live admin
                         membership" — this submap is re-filtered against
                         current active_admin_count at every threshold
                         check, never trusted as a frozen count.
      proposal_count    — monotonic counter for deterministic proposal_id
                         generation (no uuid, per GenVM restrictions) and
                         for bounding get_proposals()'s pagination.
      pending_proposal_count — live count of proposals not yet in a
                         terminal state (EXECUTED/EXPIRED), maintained
                         directly at every transition rather than derived
                         by iterating all proposals ever created — the
                         same "maintained counter over full iteration"
                         principle already used for active_admin_count
                         and every counter in metatrial_core.py
                         (total_disputes, claimant_dispute_count, etc.).
                         Read by metatrial_core.py's get_protocol_health()
                         via a cross-contract view() call.
      paused            — emergency pause flag. Lives here, not in Core,
                         per the module docstring's "Governance
                         authorizes, Core applies" pattern — Core reads
                         this via a cross-contract view() call inside
                         submit_dispute() rather than Governance ever
                         writing to Core. Gates only new dispute
                         submission; never finalize(), file_appeal(), or
                         any other in-flight-dispute action, so a pause
                         can never trap a dispute mid-process.
      external_precedent_sources — whitelisted URL prefix -> active.
                         Same "Governance owns and mutates this directly"
                         pattern as `paused` immediately above, not the
                         CORE_PARAM_UPDATE/TREASURY_UPDATE "Governance
                         authorizes, Core applies its own copy" pattern —
                         Core never stores a copy of this whitelist at
                         all, only cross-contract-reads it per citation
                         via is_external_source_active().
    """

    admins:             gl.storage.TreeMap[str, bool]
    admin_list:         gl.storage.DynArray[str]
    active_admin_count: u256
    bootstrap_complete: bool

    proposals:              gl.storage.TreeMap[str, ProposalRecord]
    approvals:               gl.storage.TreeMap[str, gl.storage.TreeMap[str, bool]]
    proposal_count:          u256
    pending_proposal_count:  u256

    paused: bool
    external_precedent_sources: gl.storage.TreeMap[str, bool]

    def __init__(self) -> None:
        deployer_hex = gl.message.sender_address.as_hex.lower()
        self.admins[deployer_hex] = True
        self.admin_list.append(deployer_hex)
        self.active_admin_count = u256(1)
        self.bootstrap_complete = False
        self.proposal_count     = u256(0)
        self.pending_proposal_count = u256(0)
        self.paused = False
        gl.vm.trace("BOOTSTRAP_INITIALIZED|deployer:" + deployer_hex)

    # ── Internal Utilities ────────────────────────────────────────────────────

    def _require(self, condition: bool, message: str) -> None:
        if not condition:
            raise gl.vm.UserError(message)

    def _get_now(self) -> u64:
        """
        Read transaction timestamp from GenVM runtime context. Identical
        implementation to metatrial_core.py and metatrial_attestation.py —
        this helper cannot be shared across contracts on this platform,
        so it is duplicated verbatim per the established convention
        rather than approximated differently here.
        """
        try:
            raw: str = gl.message.raw["datetime"]
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            ts = int(dt.timestamp())
            if ts < MIN_VALID_TIMESTAMP:
                raise gl.vm.UserError(
                    f"ERR:TIMESTAMP_INVALID — got {ts}, minimum is {MIN_VALID_TIMESTAMP}"
                )
            return u64(ts)
        except gl.vm.UserError:
            raise
        except Exception:
            raise gl.vm.UserError(
                "ERR:TIMESTAMP_UNAVAILABLE — gl.message.raw['datetime'] missing or unparseable"
            )

    def _is_active_admin(self, addr_hex: str) -> bool:
        """
        The single, centralized admin-membership check for this entire
        contract. Every method that needs to know "is this address
        currently an admin" — including every check performed against
        proposer, approver, and removal-target addresses — must call
        this helper, never check `addr_hex in self.admins` directly.
        """
        return self.admins.get(addr_hex, False)

    def _is_source_prefix_whitelisted(self, prefix: str) -> bool:
        """
        Exact-key lookup for a specific prefix's current active/inactive
        flag — used only for this contract's own no-op-proposal check
        ("would this be valid right now") in _validate_action_now()
        below. This is deliberately not the method Core calls: Core
        needs to know whether an arbitrary, full URL is covered by any
        active prefix (a startswith match against potentially several
        entries), which is a different operation entirely — see the
        public is_external_source_active() view for that. Mirrors
        _is_active_admin()'s centralized-helper role for its own TreeMap.
        """
        return self.external_precedent_sources.get(prefix, False)

    def _validate_new_admin_address(self, candidate_address: str) -> str:
        """
        Shared validation for any address about to be granted admin
        status: must parse as a well-formed Address, must not already
        hold an active seat, and must not be the zero address. Returns
        the validated, lowercased hex form.

        Reusable by add_admin(), transfer_admin_seat(), and
        propose_add_admin() alike, so all three paths that can grant an
        admin seat validate identically.

        The zero-address rejection mirrors _validate_treasury_params()'s
        equivalent check in metatrial_core.py (and this file's own
        ACTION_TREASURY_UPDATE branch) — same underlying concern applied
        to a different consequence. An admin seat holds no funds, so
        granting the zero address one can't burn anything, but it would
        permanently waste one of MAX_ADMINS seats on an address nobody
        can ever control, inflating active_admin_count (and therefore
        THRESHOLD_TABLE's required approval count) without contributing
        any real, exercisable voting power.
        """
        try:
            candidate = Address(candidate_address)
        except Exception:
            raise gl.vm.UserError(
                f"ERR:INVALID_ADDRESS — '{candidate_address[:40]}' is not a valid address"
            )
        candidate_hex = candidate.as_hex.lower()
        self._require(
            candidate_hex != ZERO_ADDRESS_HEX,
            "ERR:INVALID_ADDRESS — the zero address cannot hold an admin seat"
        )
        self._require(
            not self._is_active_admin(candidate_hex),
            "ERR:ALREADY_ADMIN — this address already holds an active admin seat"
        )
        return candidate_hex

    def _validate_removal_target(self, candidate_address: str) -> str:
        """
        Shared validation for a REMOVE_ADMIN target: must parse as a
        well-formed Address, and must currently BE an active admin (the
        inverse check of _validate_new_admin_address, needed because
        removal targets an existing seat rather than an empty one).
        Returns the validated, lowercased hex form.
        """
        try:
            candidate = Address(candidate_address)
        except Exception:
            raise gl.vm.UserError(
                f"ERR:INVALID_ADDRESS — '{candidate_address[:40]}' is not a valid address"
            )
        candidate_hex = candidate.as_hex.lower()
        self._require(
            self._is_active_admin(candidate_hex),
            "ERR:NOT_ACTIVE_ADMIN — target does not currently hold an active admin seat"
        )
        return candidate_hex

    def _required_threshold(self, admin_count: int) -> int:
        """
        Fixed threshold table lookup. Raises if admin_count is outside
        the 2-5 range this contract can ever be in once bootstrap is
        complete — a defensive check that should be structurally
        unreachable, but cheap to assert explicitly.

        THRESHOLD_TABLE's own valid range (2-5) is deliberately not the
        same thing as MIN_ADMINS_POST_BOOTSTRAP (3) — the table must
        still return a threshold for the brief, legitimate post-
        bootstrap window where active_admin_count is 2, even though the
        admin floor now blocks voluntarily removing down to that count.
        The error message below therefore states the table's own range
        directly rather than deriving it from MIN_ADMINS_POST_BOOTSTRAP,
        which would incorrectly claim 2 is unsupported.
        """
        self._require(
            admin_count in THRESHOLD_TABLE,
            f"ERR:INVALID_ADMIN_COUNT — {admin_count} is outside the "
            f"supported range of {min(THRESHOLD_TABLE)} to {max(THRESHOLD_TABLE)}"
        )
        return THRESHOLD_TABLE[admin_count]

    def _count_valid_approvals(self, proposal_id: str) -> int:
        """
        Counts approvals for a proposal that are still valid right now —
        i.e., given by an address that is a currently active admin. This
        is the concrete mechanism behind "approval validity tracks live
        admin membership": an approval given by an admin who has since
        been removed does not count, without needing to actively
        invalidate anything at removal time. The submap is guaranteed to
        exist by the time this is ever called, since _create_proposal()
        always populates it with the proposer's implicit approval before
        any other code path can reference it.
        """
        count = 0
        for admin_hex, approved in self.approvals[proposal_id].items():
            if approved and self._is_active_admin(admin_hex):
                count += 1
        return count

    def _validate_action_now(
        self,
        action_type:                          str,
        target_hex:                           str = "",
        participation_window:                  int = 0,
        appeal_window:                         int = 0,
        max_appeal_rounds:                     int = 0,
        confidence_tolerance:                  int = 0,
        max_disputes_per_respondent_window:    int = 0,
        max_disputes_per_claimant_window:      int = 0,
        dispute_filing_fee:                    int = 0,
        appeal_bond_amount:                    int = 0,
        treasury_address:                      str = "",
        external_source_active:                bool = False,
    ) -> bool:
        """
        The single structural/target/range validity check for all action
        types, used identically at proposal creation ("would this be
        valid if executed right now?") and at execution time ("is this
        still valid given current state?") — sharing one implementation
        so the two checks can never silently drift apart from each
        other. Returns True/False rather than raising, since the two
        call sites need to react differently to failure: creation
        rejects outright (raises), execution instead expires the
        proposal gracefully (see execute() below).

        Unused parameters for a given action_type are simply ignored —
        e.g. ADD_ADMIN/REMOVE_ADMIN never read the param_* arguments,
        CORE_PARAM_UPDATE never reads target_hex. This keeps one shared
        signature for all seven action types rather than a parallel
        per-type validation function for each.

        CORE_PARAM_UPDATE's range bounds are static constants that never
        depend on live contract state, so unlike ADD_ADMIN/REMOVE_ADMIN
        (whose validity depends on the current admin count), this
        branch's creation-time and execution-time answers will always be
        identical for a given proposal. It is still routed through this
        same shared function for consistency — every action type gets
        the same dual-validation treatment, with no special-casing for
        the one type where it happens not to matter.
        """
        current_count = int(self.active_admin_count)
        if action_type == ACTION_ADD_ADMIN:
            if current_count >= MAX_ADMINS:
                return False
            if self._is_active_admin(target_hex):
                return False
            return True
        elif action_type == ACTION_REMOVE_ADMIN:
            if current_count < MIN_ADMINS_POST_BOOTSTRAP + 1:
                # Removing would drop the count below the floor of 3 —
                # i.e., removal is only ever valid starting from 4 admins.
                return False
            if not self._is_active_admin(target_hex):
                return False
            return True
        elif action_type == ACTION_CORE_PARAM_UPDATE:
            if not (PARTICIPATION_WINDOW_MIN <= participation_window <= PARTICIPATION_WINDOW_MAX):
                return False
            if not (APPEAL_WINDOW_MIN <= appeal_window <= APPEAL_WINDOW_MAX):
                return False
            if not (MAX_APPEAL_ROUNDS_MIN <= max_appeal_rounds <= MAX_APPEAL_ROUNDS_MAX):
                return False
            if max_appeal_rounds % 2 != 0:
                # Mirrors metatrial_core.py's _validate_param_ranges()
                # evenness requirement — kept in sync by the same
                # cross-file-duplication convention already used for the
                # other four range constants above. Core's check remains
                # authoritative; this is only an early, non-authoritative
                # rejection at proposal-creation time.
                return False
            if not (CONFIDENCE_TOLERANCE_MIN <= confidence_tolerance <= CONFIDENCE_TOLERANCE_MAX):
                return False
            if not (MAX_DISPUTES_PER_RESPONDENT_MIN <= max_disputes_per_respondent_window <= MAX_DISPUTES_PER_RESPONDENT_MAX):
                return False
            if not (MAX_DISPUTES_PER_CLAIMANT_MIN <= max_disputes_per_claimant_window <= MAX_DISPUTES_PER_CLAIMANT_MAX):
                return False
            return True
        elif action_type == ACTION_PAUSE:
            # Invalid to propose pausing an already-paused protocol —
            # same "would this be valid right now" question every other
            # action type answers, just against Governance's own paused
            # flag instead of the admin set.
            return not self.paused
        elif action_type == ACTION_UNPAUSE:
            return self.paused
        elif action_type == ACTION_TREASURY_UPDATE:
            if not (0 <= dispute_filing_fee <= DISPUTE_FILING_FEE_MAX):
                return False
            if not (0 <= appeal_bond_amount <= APPEAL_BOND_AMOUNT_MAX):
                return False
            try:
                treasury = Address(treasury_address)
            except Exception:
                return False
            # Address() construction only confirms syntactic validity —
            # it says nothing about the zero address specifically, which
            # parses cleanly but is a burn address in practice. Mirrored
            # in metatrial_core.py's own equivalent check
            # (_validate_treasury_params()) — claim_settlement() is
            # confirmed to move real value, so a zero-address treasury
            # would silently and irrecoverably burn every future
            # forfeited fee/bond.
            if treasury.as_hex.lower() == ZERO_ADDRESS_HEX:
                return False
            return True
        elif action_type == ACTION_EXTERNAL_SOURCE_UPDATE:
            # target_hex holds the whitelisted URL prefix for this action
            # type (see the module docstring's EXTERNAL_SOURCE_UPDATE
            # section for why this record's generic field is reused
            # rather than adding a second string field).
            if not (MIN_EXTERNAL_SOURCE_PREFIX_LEN <= len(target_hex) <= MAX_EXTERNAL_SOURCE_PREFIX_LEN):
                return False
            if not target_hex.startswith(REQUIRED_EXTERNAL_SOURCE_SCHEME):
                return False
            # A prefix must end in "/" — this is a normalization
            # requirement, not merely a style preference.
            # is_external_source_active()'s matching is a plain
            # str.startswith(prefix, url) check with no concept of a
            # hostname/path boundary; requiring every whitelisted prefix
            # to be terminated by "/" makes that boundary explicit and
            # unambiguous in the prefix itself, so startswith() can
            # never be fooled by a longer, unrelated hostname that
            # merely begins with the same characters (e.g. an
            # un-terminated "https://law.cornell.edu" would also match
            # the attacker-controlled
            # "https://law.cornell.edu.evil.example/", since nothing in
            # the prefix pins where the real hostname ends; "https://
            # law.cornell.edu/" cannot match that same attacker string,
            # because the character immediately after "law.cornell.edu"
            # differs — "." in the attacker's hostname vs. the required
            # "/" in the prefix). Combined with MIN_EXTERNAL_SOURCE_
            # PREFIX_LEN below, this also closes the degenerate case of
            # a bare "https://" (8 characters, itself already ends in
            # "/") being approved as a prefix that would then match
            # every possible https URL in existence.
            if not target_hex.endswith("/"):
                return False
            # No-op protection — same "would this be valid right now"
            # question PAUSE/UNPAUSE answer against their own single
            # flag, applied here against this specific prefix's current
            # flag instead.
            if self._is_source_prefix_whitelisted(target_hex) == external_source_active:
                return False
            return True
        else:
            return False

    def _maybe_reach_threshold(self, proposal_id: str, proposal: ProposalRecord, now: u64) -> None:
        """
        Shared transition logic: recompute the current threshold and the
        current count of still-valid approvals, and transition the
        proposal from PENDING_APPROVALS to TIMELOCKED if the threshold is
        now met. Called both immediately after proposal creation (for the
        theoretical case, per the table, this ever fully satisfies a
        threshold on its own — it never does at any current table entry,
        since the minimum required is always >= 2, but this call keeps
        creation and approval consistent through one shared code path
        rather than asserting that fact and skipping the check) and after
        every explicit approve() call.
        """
        threshold = self._required_threshold(int(self.active_admin_count))
        valid_approvals = self._count_valid_approvals(proposal_id)
        if valid_approvals >= threshold and proposal.status == STATUS_PENDING_APPROVALS:
            proposal.threshold_reached_at = now
            proposal.ready_at             = u64(int(now) + TIMELOCK_SECONDS)
            proposal.status               = STATUS_TIMELOCKED
            self.proposals[proposal_id]   = proposal
            gl.vm.trace(
                f"PROPOSAL_THRESHOLD_REACHED|id:{proposal_id}|"
                f"valid_approvals:{valid_approvals}|threshold:{threshold}|"
                f"ready_at:{int(proposal.ready_at)}"
            )

    def _make_proposal_id(self, counter: u256) -> str:
        return f"PROP-{int(counter):08d}"

    def _create_proposal(
        self,
        action_type: str,
        target_hex:  str = "",
        participation_window:                  int = 0,
        appeal_window:                         int = 0,
        max_appeal_rounds:                     int = 0,
        confidence_tolerance:                  int = 0,
        max_disputes_per_respondent_window:    int = 0,
        max_disputes_per_claimant_window:      int = 0,
        dispute_filing_fee:                    int = 0,
        appeal_bond_amount:                    int = 0,
        treasury_address:                      str = "",
        external_source_active:                bool = False,
    ) -> str:
        """
        Shared proposal-creation bookkeeping for every propose_*() method,
        after each has already performed its own action-specific
        validation. Records the proposer's implicit first approval, then
        runs the same shared threshold check every approve() call uses.

        Every param_* argument defaults to 0/"" and is only ever passed
        non-default by the one propose_*() method whose action type it
        belongs to; every other proposal type leaves it at its default.
        """
        now          = self._get_now()
        sender_hex   = gl.message.sender_address.as_hex.lower()
        proposal_id  = self._make_proposal_id(self.proposal_count)
        self.proposal_count = u256(int(self.proposal_count) + 1)
        self.pending_proposal_count = u256(int(self.pending_proposal_count) + 1)

        proposal = ProposalRecord(
            proposal_id          = proposal_id,
            action_type          = action_type,
            target_hex           = target_hex,
            proposer_hex         = sender_hex,
            created_at           = now,
            expires_at           = u64(int(now) + APPROVAL_WINDOW_SECONDS),
            threshold_reached_at = u64(0),
            ready_at             = u64(0),
            status               = STATUS_PENDING_APPROVALS,
            param_participation_window             = u256(participation_window),
            param_appeal_window                    = u256(appeal_window),
            param_max_appeal_rounds                = u256(max_appeal_rounds),
            param_confidence_tolerance              = u256(confidence_tolerance),
            param_max_disputes_per_respondent_window = u256(max_disputes_per_respondent_window),
            param_max_disputes_per_claimant_window   = u256(max_disputes_per_claimant_window),
            param_dispute_filing_fee = u256(dispute_filing_fee),
            param_appeal_bond_amount = u256(appeal_bond_amount),
            param_treasury_address   = treasury_address,
            param_external_source_active = external_source_active,
        )
        self.proposals[proposal_id] = proposal
        self.approvals.get_or_insert_default(proposal_id)[sender_hex] = True

        gl.vm.trace(
            f"PROPOSAL_CREATED|id:{proposal_id}|action:{action_type}|"
            f"target:{target_hex}|proposer:{sender_hex}|"
            f"expires_at:{int(proposal.expires_at)}"
        )

        self._maybe_reach_threshold(proposal_id, proposal, now)
        return proposal_id

    # ── Bootstrap ─────────────────────────────────────────────────────────────

    @gl.public.write
    def add_admin(self, new_admin_address: str) -> None:
        """
        Bootstrap exception — adds the second admin only. No proposal,
        no approval window, no timelock: immediate execution within this
        single transaction.

        This is the one and only time this method may succeed. The instant
        it does, bootstrap_complete is permanently set to True, and
        every future call to this method is rejected outright, regardless
        of active_admin_count at that time (gated on the permanent flag,
        not recomputed from the count).

        The 3rd, 4th, and 5th admin are added via propose_add_admin() /
        approve() / execute() below — this method never extends to them.

        Operational recommendation (not contract-enforced — see
        MIN_ADMINS_POST_BOOTSTRAP's own comment): the protocol operator
        should propose and execute a 3rd admin promptly after this call
        completes. Bootstrap ends at exactly 2 active admins, which is
        below the post-bootstrap floor of 3 — while sitting at 2, the
        loss of either admin's key is an unrecoverable lockout (reaching
        3, the only way to remove a dead key, itself requires 2-of-2
        approval, which a lost key makes impossible to obtain). Nothing
        in this contract forces propose_add_admin() to be called at all,
        let alone quickly; this is deliberately left as an operational
        practice rather than an enforced precondition, since enforcing
        it would require blocking some other, unrelated action on it.
        """
        self._require(
            not self.bootstrap_complete,
            "ERR:BOOTSTRAP_COMPLETE — add_admin's bootstrap exception is a "
            "one-time-only path and is no longer available; post-bootstrap "
            "admin additions require propose_add_admin()"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only the current sole admin may add the second admin"
        )
        self._require(
            int(self.active_admin_count) == 1,
            "ERR:BOOTSTRAP_STATE_INVALID — expected exactly one active admin"
        )

        new_hex = self._validate_new_admin_address(new_admin_address)

        self.admins[new_hex] = True
        self.admin_list.append(new_hex)
        self.active_admin_count = u256(2)
        self.bootstrap_complete = True

        gl.vm.trace("BOOTSTRAP_ADMIN_ADDED|added:" + new_hex + "|by:" + sender_hex)
        gl.vm.trace(
            "BOOTSTRAP_COMPLETE|admin_count:2 — multisig + timelock now "
            "governs every future admin-set change"
        )

    @gl.public.write
    def transfer_admin_seat(self, new_admin_address: str) -> None:
        """
        Bootstrap-phase-only safety valve. Permanently disabled the
        instant bootstrap completes. Not a general post-bootstrap
        key-rotation mechanism — see the module docstring.
        """
        self._require(
            not self.bootstrap_complete,
            "ERR:BOOTSTRAP_COMPLETE — transfer_admin_seat is a bootstrap-"
            "phase-only safety valve and is no longer available"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only the current sole admin may transfer their own seat"
        )
        self._require(
            int(self.active_admin_count) == 1,
            "ERR:BOOTSTRAP_STATE_INVALID — expected exactly one active admin"
        )

        new_hex = self._validate_new_admin_address(new_admin_address)

        self.admins[sender_hex] = False
        self.admins[new_hex]    = True
        self.admin_list.append(new_hex)
        # active_admin_count unchanged — a 1-for-1 seat swap.

        gl.vm.trace("BOOTSTRAP_SEAT_TRANSFERRED|from:" + sender_hex + "|to:" + new_hex)

    # ── Multisig Proposals ─────────────────────────────────────────────────────

    @gl.public.write
    def propose_add_admin(self, target_address: str) -> str:
        """
        Propose adding a 3rd, 4th, or 5th admin. Requires bootstrap to be
        complete (2 admins already present) — the 2nd admin is added only
        via the bootstrap exception above, never through this path.

        Creation-time validation ("would this be valid right now?"):
        current active_admin_count must be below MAX_ADMINS (5), and the
        target must not already hold an active seat. The proposer's
        creation act counts as their own implicit approval; at every
        admin count in THRESHOLD_TABLE, at least one more distinct
        admin's approve() call is still required.

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — the admin set has only one member; "
            "use add_admin() to add the second admin instead"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose adding a new admin"
        )
        target_hex = self._validate_new_admin_address(target_address)
        self._require(
            self._validate_action_now(ACTION_ADD_ADMIN, target_hex),
            f"ERR:PROPOSAL_INVALID — adding this admin would exceed the "
            f"maximum of {MAX_ADMINS} admins"
        )
        return self._create_proposal(ACTION_ADD_ADMIN, target_hex)

    @gl.public.write
    def propose_remove_admin(self, target_address: str) -> str:
        """
        Propose removing an existing admin. Only possible starting from 4
        active admins (so the result never falls below the floor of 3 —
        see MIN_ADMINS_POST_BOOTSTRAP's own comment for the full
        reasoning). The target of removal retains full ordinary admin
        rights while the proposal is pending, including the right to
        approve() it themselves — no special-casing; self-approval or
        self-rejection of one's own removal proposal has no distinct
        effect on the mechanism beyond being one vote among the
        threshold.

        Creation-time validation: current active_admin_count must be at
        least 4, and the target must currently be an active admin.

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — admin removal is not available "
            "during the single-admin bootstrap phase"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose removing an admin"
        )
        target_hex = self._validate_removal_target(target_address)
        self._require(
            self._validate_action_now(ACTION_REMOVE_ADMIN, target_hex),
            f"ERR:PROPOSAL_INVALID — removal requires at least "
            f"{MIN_ADMINS_POST_BOOTSTRAP + 1} active admins currently present"
        )
        return self._create_proposal(ACTION_REMOVE_ADMIN, target_hex)

    @gl.public.write
    def propose_core_param_update(
        self,
        participation_window:             int,
        appeal_window:                    int,
        max_appeal_rounds:                int,
        confidence_tolerance:             int,
        max_disputes_per_respondent_window: int,
        max_disputes_per_claimant_window: int,
    ) -> str:
        """
        Propose a change to metatrial_core.py's six protocol parameters.

        Implements the protocol invariant: "Governance may authorize
        protocol changes but shall never directly own or mutate
        arbitration state." Governance authorizes; Core applies. This
        method — and every other method in this contract — never calls
        into metatrial_core.py. Reaching EXECUTED status on the resulting
        proposal is the complete extent of what happens here: an
        immutable, multisig-approved, timelocked record that this
        specific parameter set has been authorized. Core is solely
        responsible for reading that record (via its own
        apply_governance_action() method, a cross-contract read it
        initiates itself) and applying it to its own storage, which Core
        continues to exclusively own.

        All six parameters must be specified together, exactly matching
        metatrial_core.py's own propose_parameter_update() convention
        (now superseded by this method once governance is configured —
        see that method's updated docstring in metatrial_core.py).

        Parameter constraints (mirrors Core's bounds exactly):
          participation_window:  3600 to 604800  (1h to 7 days)
          appeal_window:         3600 to 604800  (1h to 7 days)
          max_appeal_rounds:     1 to 5
          confidence_tolerance:  5 to 30
          max_disputes_per_respondent_window: 1 to 100
          max_disputes_per_claimant_window:   1 to 200

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — protocol parameter changes are "
            "not available during the single-admin bootstrap phase"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose a protocol parameter change"
        )
        self._require(
            self._validate_action_now(
                ACTION_CORE_PARAM_UPDATE, "",
                participation_window, appeal_window, max_appeal_rounds,
                confidence_tolerance, max_disputes_per_respondent_window,
                max_disputes_per_claimant_window,
            ),
            "ERR:PROPOSAL_INVALID — one or more parameter values are out of range"
        )
        return self._create_proposal(
            ACTION_CORE_PARAM_UPDATE, "",
            participation_window, appeal_window, max_appeal_rounds,
            confidence_tolerance, max_disputes_per_respondent_window,
            max_disputes_per_claimant_window,
        )

    @gl.public.write
    def propose_treasury_update(
        self,
        dispute_filing_fee: int,
        appeal_bond_amount: int,
        treasury_address:   str,
    ) -> str:
        """
        Propose new economic/settlement parameters — the dispute filing
        fee, the appeal bond amount, and the treasury address forfeited
        funds are recorded as owed to.

        metatrial_core.py's claim_settlement() performs a real, on-chain
        emit_transfer() directly, callable permissionlessly by anyone,
        with delivery status recorded on-chain — see that file's own
        Settlement Interface docstring for the full architecture. This
        contract configures no relayer address, has no relayer concept,
        and grants no address any privileged role in delivery —
        claim_settlement() is itself permissionless.

        Deliberately a separate action type from propose_core_param_update(),
        not a bundled extension of it — these values govern real
        custodied-fund entitlements and carry a higher trust bar than the
        arbitration-timing parameters, and keeping them distinct means
        changing one doesn't require re-specifying the other. Both go
        through the identical multisig + timelock mechanism; there is no
        separate, weaker path for either.

        All three values must be specified together, matching the
        established "all related parameters specified together"
        convention already used by propose_core_param_update().

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — treasury/settlement parameter "
            "changes are not available during the single-admin bootstrap phase"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose a treasury update"
        )
        self._require(
            self._validate_action_now(
                ACTION_TREASURY_UPDATE, "", 0, 0, 0, 0, 0, 0,
                dispute_filing_fee, appeal_bond_amount, treasury_address,
            ),
            "ERR:PROPOSAL_INVALID — one or more values are out of range or "
            "not a valid address"
        )
        return self._create_proposal(
            ACTION_TREASURY_UPDATE, "", 0, 0, 0, 0, 0, 0,
            dispute_filing_fee, appeal_bond_amount, treasury_address,
        )

    @gl.public.write
    def propose_external_source_update(self, source_prefix: str, active: bool) -> str:
        """
        Propose adding/activating (active=True) or deactivating
        (active=False) a whitelisted external-precedent-source URL
        prefix. A single entry point for both directions, rather than
        two near-duplicate propose_*() methods — the underlying state
        transition is symmetric (set this prefix's flag to this value),
        the same way PAUSE/UNPAUSE are two methods sharing one mechanism
        here, just collapsed into one method since there is no
        asymmetric risk profile between the two directions the way
        there arguably is for pause/unpause.

        source_prefix must start with "https://", end with "/" (a
        normalization requirement, not a style preference — it pins the
        hostname/path boundary the prefix-matching startswith() check
        relies on, closing the subdomain-confusion risk an unterminated
        prefix like "https://law.cornell.edu" would otherwise carry),
        and fall within MIN_EXTERNAL_SOURCE_PREFIX_LEN/
        MAX_EXTERNAL_SOURCE_PREFIX_LEN — see _validate_action_now()'s
        ACTION_EXTERNAL_SOURCE_UPDATE branch for the exact bounds and
        reasoning. Rejected at creation if source_prefix is already in
        the requested state (no-op protection, same "would this be
        valid right now" question every other action type answers).

        Once EXECUTED, self.external_precedent_sources[source_prefix]
        becomes `active` immediately — this is Governance mutating its
        own storage directly (the same pattern `paused` uses), not the
        CORE_PARAM_UPDATE/TREASURY_UPDATE "Governance authorizes, Core
        applies its own copy" pattern. metatrial_core.py cross-contract-
        reads this via is_external_source_active(url) at citation time,
        exactly mirroring is_paused()'s role for submit_dispute().

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — external source whitelist "
            "changes are not available during the single-admin bootstrap phase"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose an "
            "external source whitelist update"
        )
        self._require(
            self._validate_action_now(
                ACTION_EXTERNAL_SOURCE_UPDATE, source_prefix, 0, 0, 0, 0, 0, 0, 0, 0, "",
                active,
            ),
            "ERR:PROPOSAL_INVALID — source_prefix is malformed (must be "
            "non-empty, length-capped, and start with 'https://') or "
            "already in the requested active state"
        )
        return self._create_proposal(
            ACTION_EXTERNAL_SOURCE_UPDATE, source_prefix, 0, 0, 0, 0, 0, 0, 0, 0, "",
            active,
        )

    @gl.public.write
    def propose_pause(self) -> str:
        """
        Propose pausing new dispute submission across the protocol. Same
        full multisig + timelock flow as every other action type here —
        an emergency pause is not exempt from the deliberation this
        contract exists to enforce, since a pause mechanism that could
        itself be triggered by a single compromised key would be a
        bigger risk than the incidents it exists to contain. Once
        EXECUTED, self.paused becomes True; Core's submit_dispute() will
        observe this on its next call via a cross-contract view() read.
        Rejected at creation if the protocol is already paused.

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — pause is not available during "
            "the single-admin bootstrap phase"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose a pause"
        )
        self._require(
            self._validate_action_now(ACTION_PAUSE),
            "ERR:PROPOSAL_INVALID — the protocol is already paused"
        )
        return self._create_proposal(ACTION_PAUSE, "")

    @gl.public.write
    def propose_unpause(self) -> str:
        """
        Propose lifting an active pause. Same full multisig + timelock
        flow — deliberately not a faster path than propose_pause(),
        since an attacker who could bypass deliberation to unpause would
        defeat the pause's entire purpose. Rejected at creation if the
        protocol is not currently paused.

        Returns the new proposal_id.
        """
        self._require(
            self.bootstrap_complete,
            "ERR:BOOTSTRAP_NOT_COMPLETE — unpause is not available during "
            "the single-admin bootstrap phase"
        )
        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may propose an unpause"
        )
        self._require(
            self._validate_action_now(ACTION_UNPAUSE),
            "ERR:PROPOSAL_INVALID — the protocol is not currently paused"
        )
        return self._create_proposal(ACTION_UNPAUSE, "")

    @gl.public.write
    def approve(self, proposal_id: str) -> None:
        """
        Record an explicit approval for a pending proposal.

        Rejects outright if the proposal has already reached a terminal
        state (EXECUTED or EXPIRED). If the 24h approval window has
        elapsed while the proposal was still PENDING_APPROVALS, this call
        formalizes that as EXPIRED and returns normally without
        recording an approval or raising — the first such discovery is a
        graceful state-machine transition, not a caller error, and
        persisting it requires not raising afterward (an exception would
        roll back the write). A second call against an already-EXPIRED
        proposal is rejected outright by the terminal-state check above.

        Each admin may approve a given proposal at most once, ever; the
        proposer's own creation act already consumed their allowance and
        they may not additionally call this method on their own proposal.
        """
        self._require(
            proposal_id in self.proposals,
            "ERR:PROPOSAL_NOT_FOUND"
        )
        proposal = self.proposals[proposal_id]
        self._require(
            proposal.status not in (STATUS_EXECUTED, STATUS_EXPIRED),
            f"ERR:PROPOSAL_ALREADY_FINALIZED — status is {proposal.status}"
        )

        now = self._get_now()

        if proposal.status == STATUS_PENDING_APPROVALS and int(now) > int(proposal.expires_at):
            proposal.status = STATUS_EXPIRED
            self.proposals[proposal_id] = proposal
            self.pending_proposal_count = u256(int(self.pending_proposal_count) - 1)
            gl.vm.trace(f"PROPOSAL_EXPIRED|id:{proposal_id}|reason:approval_window_elapsed")
            return

        self._require(
            proposal.status == STATUS_PENDING_APPROVALS,
            f"ERR:APPROVALS_CLOSED — proposal is already {proposal.status}, "
            f"no further approvals are accepted"
        )

        sender_hex = gl.message.sender_address.as_hex.lower()
        self._require(
            self._is_active_admin(sender_hex),
            "ERR:NOT_ADMIN — only a current admin may approve a proposal"
        )
        self._require(
            sender_hex != proposal.proposer_hex,
            "ERR:PROPOSER_CANNOT_APPROVE_OWN_PROPOSAL — the proposer's "
            "creation act already counts as their approval"
        )
        self._require(
            not self.approvals[proposal_id].get(sender_hex, False),
            "ERR:ALREADY_APPROVED — this admin has already approved this proposal"
        )

        self.approvals.get_or_insert_default(proposal_id)[sender_hex] = True
        gl.vm.trace(f"PROPOSAL_APPROVED|id:{proposal_id}|by:{sender_hex}")

        self._maybe_reach_threshold(proposal_id, proposal, now)

    @gl.public.write
    def execute(self, proposal_id: str) -> None:
        """
        Execute a proposal whose timelock has elapsed. Permissionless —
        any address may call this, not only admins.

        Rejects outright if the proposal is already EXECUTED or EXPIRED
        (exactly-once execution, no silent no-op replay, unlike the
        Attestation Registry's deliberately idempotent
        register_finalized()).

        If still PENDING_APPROVALS past its approval window, formalizes
        EXPIRED (same graceful, first-discovery transition as approve()).
        If TIMELOCKED but the timelock has not yet elapsed, rejects with a
        clear error. If TIMELOCKED and the timelock has elapsed, re-runs
        the full dual-validation check against current state — current
        admin count, current target state, and the current count of
        still-valid approvals against the current threshold — and either
        applies the action (EXECUTED) or formalizes EXPIRED, in both
        cases persisting the outcome rather than raising, since there is
        nothing to roll back and the proposal's fate must be recorded
        either way.
        """
        self._require(
            proposal_id in self.proposals,
            "ERR:PROPOSAL_NOT_FOUND"
        )
        proposal = self.proposals[proposal_id]
        self._require(
            proposal.status not in (STATUS_EXECUTED, STATUS_EXPIRED),
            f"ERR:PROPOSAL_ALREADY_FINALIZED — status is {proposal.status}"
        )

        now = self._get_now()

        if proposal.status == STATUS_PENDING_APPROVALS:
            if int(now) > int(proposal.expires_at):
                proposal.status = STATUS_EXPIRED
                self.proposals[proposal_id] = proposal
                self.pending_proposal_count = u256(int(self.pending_proposal_count) - 1)
                gl.vm.trace(f"PROPOSAL_EXPIRED|id:{proposal_id}|reason:approval_window_elapsed")
                return
            raise gl.vm.UserError(
                "ERR:THRESHOLD_NOT_REACHED — this proposal has not yet "
                "gathered enough approvals to enter its timelock"
            )

        # status == STATUS_TIMELOCKED from here on
        self._require(
            int(now) >= int(proposal.ready_at),
            f"ERR:TIMELOCK_ACTIVE — not executable until timestamp {int(proposal.ready_at)}"
        )

        # Full revalidation against current state — structural bounds,
        # target state, and current-valid-approval count against the
        # current threshold: a stale approval from an admin removed
        # after this proposal was timelocked does not count.
        current_threshold = self._required_threshold(int(self.active_admin_count))
        valid_approvals   = self._count_valid_approvals(proposal_id)
        structurally_valid = self._validate_action_now(
            proposal.action_type,
            proposal.target_hex,
            int(proposal.param_participation_window),
            int(proposal.param_appeal_window),
            int(proposal.param_max_appeal_rounds),
            int(proposal.param_confidence_tolerance),
            int(proposal.param_max_disputes_per_respondent_window),
            int(proposal.param_max_disputes_per_claimant_window),
            int(proposal.param_dispute_filing_fee),
            int(proposal.param_appeal_bond_amount),
            proposal.param_treasury_address,
            proposal.param_external_source_active,
        )

        if not structurally_valid or valid_approvals < current_threshold:
            proposal.status = STATUS_EXPIRED
            self.proposals[proposal_id] = proposal
            self.pending_proposal_count = u256(int(self.pending_proposal_count) - 1)
            gl.vm.trace(
                f"PROPOSAL_EXPIRED|id:{proposal_id}|reason:revalidation_failed|"
                f"structurally_valid:{structurally_valid}|"
                f"valid_approvals:{valid_approvals}|current_threshold:{current_threshold}"
            )
            return

        # Apply the action.
        # outcome_detail records the actual resulting state for every
        # action type, not just EXTERNAL_SOURCE_UPDATE — for ADD_ADMIN/
        # REMOVE_ADMIN/PAUSE/UNPAUSE the action_type string is already
        # fully self-describing (there is no second possible outcome for
        # "PAUSE" to have had), so this is redundant-but-harmless for
        # those; for EXTERNAL_SOURCE_UPDATE specifically, it is not
        # redundant — one action type covers two opposite outcomes
        # (activate vs. deactivate a prefix), and without this field an
        # auditor could identify which prefix a PROPOSAL_EXECUTED entry
        # touched but not which direction it moved. Populated in every
        # branch so the shared trace call below never has to guess.
        outcome_detail = ""
        if proposal.action_type == ACTION_ADD_ADMIN:
            self.admins[proposal.target_hex] = True
            self.admin_list.append(proposal.target_hex)
            self.active_admin_count = u256(int(self.active_admin_count) + 1)
            outcome_detail = f"admin_added:{proposal.target_hex}"
        elif proposal.action_type == ACTION_REMOVE_ADMIN:
            self.admins[proposal.target_hex] = False
            self.active_admin_count = u256(int(self.active_admin_count) - 1)
            outcome_detail = f"admin_removed:{proposal.target_hex}"
        elif proposal.action_type == ACTION_CORE_PARAM_UPDATE:
            # Protocol invariant: "Governance may authorize protocol
            # changes but shall never directly own or mutate arbitration
            # state." This branch deliberately does nothing beyond the
            # status flip below — reaching EXECUTED status is the
            # authorization. metatrial_core.py is solely responsible
            # for reading this authorized, immutable record (via
            # apply_governance_action()) and applying it to its own
            # parameter storage. No cross-contract call is made from
            # here, and no Core storage is touched from this contract.
            outcome_detail = (
                f"authorized_for_core:participation_window="
                f"{int(proposal.param_participation_window)},appeal_window="
                f"{int(proposal.param_appeal_window)},max_appeal_rounds="
                f"{int(proposal.param_max_appeal_rounds)},confidence_tolerance="
                f"{int(proposal.param_confidence_tolerance)},"
                f"max_disputes_per_respondent_window="
                f"{int(proposal.param_max_disputes_per_respondent_window)},"
                f"max_disputes_per_claimant_window="
                f"{int(proposal.param_max_disputes_per_claimant_window)}"
            )
        elif proposal.action_type == ACTION_PAUSE:
            # The pause flag lives here, in Governance — this is
            # Governance mutating its own storage, not Core's, so it does
            # not conflict with the invariant above. Core reads this
            # flag via a cross-contract view() call from inside
            # submit_dispute() (the only method it gates).
            self.paused = True
            outcome_detail = "paused:True"
        elif proposal.action_type == ACTION_UNPAUSE:
            self.paused = False
            outcome_detail = "paused:False"
        elif proposal.action_type == ACTION_TREASURY_UPDATE:
            # Same "Governance authorizes, Core applies" pattern as
            # CORE_PARAM_UPDATE — deliberately no local mutation beyond
            # the status flip below. Reaching EXECUTED status is the
            # authorization; metatrial_core.py's apply_governance_action()
            # is solely responsible for reading this record and applying
            # dispute_filing_fee/appeal_bond_amount/treasury_address to
            # its own storage. These values carry a higher trust bar than
            # ordinary CORE_PARAM_UPDATE values (they govern real
            # custodied-fund entitlements), but the mechanism is
            # identical — the higher bar comes from what these values do
            # once applied, not from a different or weaker approval path.
            # No relayer address exists anywhere in this proposal type —
            # the relayer has no privileged relationship with this
            # contract at all (see metatrial_core.py's Settlement
            # interface docstring).
            outcome_detail = (
                f"authorized_for_core:dispute_filing_fee="
                f"{int(proposal.param_dispute_filing_fee)},appeal_bond_amount="
                f"{int(proposal.param_appeal_bond_amount)},treasury_address="
                f"{proposal.param_treasury_address}"
            )
        elif proposal.action_type == ACTION_EXTERNAL_SOURCE_UPDATE:
            # The whitelist lives here, in Governance — same "Governance
            # mutating its own storage, not Core's" pattern as
            # ACTION_PAUSE/ACTION_UNPAUSE immediately above, not the
            # CORE_PARAM_UPDATE/TREASURY_UPDATE "authorize only, Core
            # applies its own copy" pattern. Core cross-contract-reads
            # this via is_external_source_active(url) at citation time,
            # exactly mirroring is_paused()'s role for submit_dispute().
            self.external_precedent_sources[proposal.target_hex] = \
                proposal.param_external_source_active
            outcome_detail = f"prefix_active:{proposal.param_external_source_active}"
        else:
            # Structurally unreachable — action_type is fixed at creation
            # to one of the seven known constants — but fail loudly
            # rather than silently applying nothing if it is ever reached.
            raise gl.vm.UserError(f"ERR:UNKNOWN_ACTION_TYPE — {proposal.action_type}")

        proposal.status = STATUS_EXECUTED
        self.proposals[proposal_id] = proposal
        self.pending_proposal_count = u256(int(self.pending_proposal_count) - 1)
        gl.vm.trace(
            f"PROPOSAL_EXECUTED|id:{proposal_id}|action:{proposal.action_type}|"
            f"target:{proposal.target_hex}|new_admin_count:{int(self.active_admin_count)}|"
            f"outcome:{outcome_detail}"
        )

    # ── Public View Methods ───────────────────────────────────────────────────

    @gl.public.view
    def is_admin(self, address_hex: str) -> bool:
        """Check whether a given address currently holds an active admin seat."""
        try:
            addr = Address(address_hex)
        except Exception:
            raise gl.vm.UserError(
                f"ERR:INVALID_ADDRESS — '{address_hex[:40]}' is not a valid address"
            )
        return self._is_active_admin(addr.as_hex.lower())

    @gl.public.view
    def get_admins(self) -> list:
        """Active admins, in the order they were originally granted."""
        result = []
        for addr_hex in self.admin_list:
            if self._is_active_admin(addr_hex):
                result.append(addr_hex)
        return result

    @gl.public.view
    def get_active_admin_count(self) -> int:
        """Current number of active admins (O(1))."""
        return int(self.active_admin_count)

    @gl.public.view
    def is_bootstrap_complete(self) -> bool:
        """True once the second admin has ever been added. Permanent."""
        return self.bootstrap_complete

    @gl.public.view
    def get_current_threshold(self) -> int:
        """
        The number of approvals a NEW proposal would need right now, per
        the fixed threshold table. Informational only — the actual
        threshold applied to any given proposal is always recomputed live
        at the moment of each check, never read from this view.
        """
        return self._required_threshold(int(self.active_admin_count))

    @gl.public.view
    def is_paused(self) -> bool:
        """
        Current emergency-pause state. This is the exact method
        metatrial_core.py's submit_dispute() cross-contract-reads via
        view() before accepting a new dispute — the only method this
        flag gates. A pause must never trap an in-flight dispute or
        block finalize()/file_appeal().
        """
        return self.paused

    @gl.public.view
    def is_external_source_active(self, url: str) -> bool:
        """
        True if `url` starts with any currently-active whitelisted
        prefix. This is the exact method metatrial_core.py cross-
        contract-reads via view() — both at citation time (in
        _validate_external_precedent_urls(), for an early, best-effort
        rejection) and again, independently, at arbitration time (in
        _run_arbitration(), immediately before each fetch, since the
        whitelist can change between citation and the possibly-much-
        later arbitration call) — mirroring is_paused()'s cross-
        contract-read role for submit_dispute().

        Iterates the whitelist directly rather than requiring an exact-
        match lookup: the whitelist is small and can only grow through
        the full multisig + timelock proposal flow, so unbounded
        iteration here carries no realistic DoS risk. This is a
        different operation from _is_source_prefix_whitelisted() above
        — that helper does an exact-key lookup for one specific,
        already-known prefix (used only for this contract's own no-op-
        proposal check); this view does a startswith match against an
        arbitrary, caller-supplied full URL across every whitelisted
        entry, which is what a citing party's real, full URL requires.
        """
        for prefix, active in self.external_precedent_sources.items():
            if active and url.startswith(prefix):
                return True
        return False

    @gl.public.view
    def get_pending_proposal_count(self) -> int:
        """
        Live count of proposals not yet in a terminal state
        (EXECUTED/EXPIRED). Read by metatrial_core.py's
        get_protocol_health() to surface pending-governance-action count
        without requiring that view to iterate every proposal ever
        created.
        """
        return int(self.pending_proposal_count)

    @gl.public.view
    def get_proposal(self, proposal_id: str) -> dict:
        """
        Full state of a single proposal, including live-recomputed fields.

        This is the exact method metatrial_core.py's apply_governance_action()
        cross-contract-reads via view() to discover whether a
        CORE_PARAM_UPDATE or TREASURY_UPDATE proposal has reached
        EXECUTED (authorized) status and, if so, what values it
        authorized. The param_* fields are 0/""/False for any action
        type that doesn't use them — e.g. all ten param_* fields are
        0/""/False for ADD_ADMIN/REMOVE_ADMIN/PAUSE/UNPAUSE proposals.
        For EXTERNAL_SOURCE_UPDATE proposals specifically, target_hex
        (not a param_* field) holds the whitelisted URL prefix — see
        the module docstring's EXTERNAL_SOURCE_UPDATE section.
        """
        self._require(proposal_id in self.proposals, "ERR:PROPOSAL_NOT_FOUND")
        p = self.proposals[proposal_id]
        return {
            "proposal_id":          p.proposal_id,
            "action_type":          p.action_type,
            "target_hex":           p.target_hex,
            "proposer_hex":         p.proposer_hex,
            "created_at":           int(p.created_at),
            "expires_at":           int(p.expires_at),
            "threshold_reached_at": int(p.threshold_reached_at),
            "ready_at":             int(p.ready_at),
            "status":               p.status,
            "valid_approvals_now":  self._count_valid_approvals(proposal_id),
            "current_threshold":    self._required_threshold(int(self.active_admin_count)),
            "param_participation_window":              int(p.param_participation_window),
            "param_appeal_window":                     int(p.param_appeal_window),
            "param_max_appeal_rounds":                 int(p.param_max_appeal_rounds),
            "param_confidence_tolerance":               int(p.param_confidence_tolerance),
            "param_max_disputes_per_respondent_window": int(p.param_max_disputes_per_respondent_window),
            "param_max_disputes_per_claimant_window":   int(p.param_max_disputes_per_claimant_window),
            "param_dispute_filing_fee": int(p.param_dispute_filing_fee),
            "param_appeal_bond_amount": int(p.param_appeal_bond_amount),
            "param_treasury_address":   p.param_treasury_address,
            "param_external_source_active": p.param_external_source_active,
        }

    @gl.public.view
    def get_proposal_count(self) -> int:
        """Total number of proposals ever created (monotonic, never decreases)."""
        return int(self.proposal_count)

    @gl.public.view
    def get_proposals(self, offset: int, limit: int) -> list:
        """
        Paginated list of proposal_ids in creation order, most recent
        capped at 50 per call regardless of the caller-supplied limit.
        """
        capped_limit = min(limit, 50) if limit > 0 else 50
        total = int(self.proposal_count)
        result = []
        i = offset
        while i < total and len(result) < capped_limit:
            result.append(self._make_proposal_id(u256(i)))
            i += 1
        return result

    @gl.public.view
    def get_governance_info(self) -> dict:
        """Summary view of this contract's current bootstrap, proposal, and pause state."""
        return {
            "active_admin_count": int(self.active_admin_count),
            "bootstrap_complete": self.bootstrap_complete,
            "admins":             self.get_admins(),
            "current_threshold":  self._required_threshold(int(self.active_admin_count))
                                   if self.bootstrap_complete else None,
            "total_proposals":       int(self.proposal_count),
            "pending_proposals":     int(self.pending_proposal_count),
            "paused":                self.paused,
            "scope":              "bootstrap admin seat, admin multisig, core "
                                   "protocol-parameter authorization, emergency "
                                   "pause, treasury/settlement authorization, and "
                                   "external precedent source whitelist.",
        }
