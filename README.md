<div align="center">

# MetaTrial

**Credibility without coercion.**

*AI-native decentralized arbitration, built on GenLayer.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Network](https://img.shields.io/badge/network-GenLayer%20Studio%20Devnet-6f42c1)](https://explorer-studio-dev.genlayer.com)
[![Chain ID](https://img.shields.io/badge/chain%20id-61997-blue)](https://explorer-studio-dev.genlayer.com)
[![Built with Next.js](https://img.shields.io/badge/frontend-Next.js%2015-black)](https://nextjs.org)

[Live App](https://metatrial.vercel.app) · [Deployed Contracts](#deployed-contracts) · [Contract Reference](#contract-reference) · [Running Locally](#running-locally)

</div>

---

MetaTrial is an AI-native decentralized arbitration protocol. Any two parties in a digital
relationship — a freelancer and a client, a buyer and a seller, a DAO and its contributor —
can submit a dispute. Independent AI validators reason over the submitted evidence, informed
where relevant by the protocol's own accumulated precedent. What comes out is not a score or
a vote count: it is a **structured, reasoned, auditable determination** — ruling, findings,
confidence, evidence assessments, plain-language reasoning, and a recommended resolution —
recorded immutably on-chain and, once final, attested for anyone to verify.

MetaTrial is not a substitute for courts, and it does not pretend to have the authority of
law. What it offers for the disputes the existing system fails — cross-border, too small to
litigate, too fast-moving to wait months — is something different: a verifiably reasoned
determination that any platform may choose to act on. **The attestation is the product.**
What platforms do with it is their decision.

## Table of Contents

- [Deployed Contracts](#deployed-contracts)
- [The Problem](#the-problem)
- [The MetaTrial Approach](#the-metatrial-approach)
- [Built on GenLayer](#built-on-genlayer)
- [How a Case Moves Through MetaTrial](#how-a-case-moves-through-metatrial)
- [Three-Contract Architecture](#three-contract-architecture)
- [Contract Reference](#contract-reference)
- [Reasoning & Evidence Model](#reasoning--evidence-model)
- [Governance](#governance)
- [Security Architecture](#security-architecture)
- [Finality & Verification](#finality--verification)
- [Frontend Technical Architecture](#frontend-technical-architecture)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Studio Devnet Configuration](#studio-devnet-configuration)
- [Design & Product Philosophy](#design--product-philosophy)
- [Current Status & Limitations](#current-status--limitations)
- [Contributing](#contributing)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Deployed Contracts

All three contracts are live on **GenLayer Studio Devnet** (chain ID `61997`). Addresses are
also the single source of truth read by the frontend at `app/src/lib/config/protocol.json` —
nothing in the UI hard-codes a contract address separately from this table.

| Contract | Address | Explorer |
| --- | --- | --- |
| `metatrial_core.py` | `0xC9e9d5Dc053b14eebd945D833b126eEa8c8f11c6` | [View](https://explorer-studio-dev.genlayer.com/address/0xC9e9d5Dc053b14eebd945D833b126eEa8c8f11c6) |
| `metatrial_governance.py` | `0xb8664C72316C892D641C348A3148225945615F79` | [View](https://explorer-studio-dev.genlayer.com/address/0xb8664C72316C892D641C348A3148225945615F79) |
| `metatrial_attestation.py` | `0x9bFD0300654EbB182b1639706e48dA863Db81ea3` | [View](https://explorer-studio-dev.genlayer.com/address/0x9bFD0300654EbB182b1639706e48dA863Db81ea3) |

The one-time wiring between them — `core.set_governance_address()`, `core.set_registry_address()`,
`registry.set_core_address()` — has already been executed and is now permanently locked; see
[Security Architecture](#security-architecture) for why that matters.

> Studio Devnet is a test network using test GEN. Contract source lives under [`contracts/`](./contracts)
> in this repository and is the authoritative reference — everything in this README's
> [Contract Reference](#contract-reference) section is verified directly against it.

## The Problem

Millions of digital transactions fail every day, and the recourse landscape fails with them:

- **Platform arbitration** is opaque and inconsistent. Decisions cannot be verified, reasoned
  about, or exported. You trust the platform and never see how it decided.
- **Legal action** works only for disputes large enough to justify the economics — fees,
  jurisdictions, timelines measured in months. For most digital-native disputes it is simply
  inaccessible.
- **Absorbing the loss** is the most common outcome. The dispute goes unresolved and the
  ecosystem becomes slightly less trustworthy.

Earlier on-chain dispute systems — typically human juror voting pools — improved on this, but
carry their own structural limits: juror expertise varies, verdicts arrive **without a
reasoning chain** (a number, not an argument), coordination is slow, and outcomes are forced
into binary win/lose molds that discard the nuance real disputes contain.

MetaTrial addresses all four: validators reason rather than merely vote, every verdict ships
with its full auditable argument, arbitration runs at validator speed, and the verdict schema
carries structured remedies — partial payment at a percentage, conditional delivery — rather
than a binary outcome.

## The MetaTrial Approach

A case on MetaTrial is a record that grows:

- **Case** — a claimant files unilaterally (arbitration is a claimant right), naming a
  respondent, a category, a statement, and an optional external reference linking the case to
  a platform's own case ID.
- **Evidence** — one submission per party, as inline text, a content-addressed URL
  (IPFS/Arweave, so silent substitution is cryptographically impossible), or a file reference
  with a summary. The content hash travels with the evidence and is re-verified at
  arbitration time by every validator that fetches it.
- **Reasoning** — the heart of the protocol. Validators do not score; they reason. Every
  verdict carries its reasoning chain, and the model's raw, pre-normalization finding text is
  retained verbatim alongside the canonical value, so an auditor can always see what the
  protocol recorded *and* what the model actually said.
- **Determination** — a ruling (`CLAIMANT_PREVAILS`, `RESPONDENT_PREVAILS`, `SPLIT_DECISION`,
  `INCONCLUSIVE`, `INCONCLUSIVE_FINAL`), a contract-derived confidence (never AI
  self-reported), a primary finding from a controlled vocabulary, three key findings,
  evidence quality for both parties, and a structured recommended resolution with type,
  percentage, detail, and conditions.
- **Challenge** — either party may appeal on four typed grounds (new evidence, procedural
  error, evidence integrity, reasoning defect), each demanding substantively populated
  explanation, specificity, and impact. Prior rounds are never erased: the decision history
  preserves every verdict, superseded ones included.
- **Final record** — after the appeal window closes (or the budget is exhausted, or both
  parties waived appeals), the case is sealed and an attestation is issued.
- **Attestation** — the portable, verifiable artifact: attestation ID, case ID, final
  determination, ruling code, issued time, appeal rounds, participation, and the epistemic
  basis. Anyone can verify it — no wallet required.

## Built on GenLayer

MetaTrial runs as **Intelligent Contracts**: each method executes across multiple independent
validator nodes, and GenLayer's equivalence consensus decides whether their outputs agree.
This is what makes AI-mediated reasoning auditable rather than oracular.

- **Optimistic, equivalence-based consensus.** Every validator independently runs the
  arbitration routine — building the prompt, fetching evidence and precedent, calling the
  model — and the outputs must be *equivalent*, not identical. Ruling is a **hard gate**
  (different rulings are never equivalent). The finding maps to canonical equivalence groups
  (a **strong signal**). Confidence is a **soft signal**, tolerated within a
  governance-adjustable band (15 points by default, adjustable 5–30). This anchors consensus
  on what matters while absorbing natural LLM variation.
- **A stripped evaluator.** The equivalence evaluator sees only three fields — ruling, finding
  group, confidence. The full verdict, including all reasoning, is deliberately kept out of
  its view. Extending what the AI can be shown has never been allowed to extend what a
  compromised input could influence: every piece of untrusted content — statements, evidence,
  precedent — is delimited and marked non-authoritative in the prompt, with explicit
  injection-resistance instructions.
- **Deterministic where it must be.** Confidence is derived by the contract with
  integer-only arithmetic from structural signals — never floating-point, never
  self-reported. Anything non-deterministic (model calls, URL fetching) lives inside pure
  closures that touch no contract storage.
- **Epistemic honesty.** Every verdict, attestation, and registry record carries the same
  statement: *this determination reflects solely the evidence submitted; MetaTrial does not
  independently verify its authenticity, accuracy, or completeness.* That honesty is the
  design, not a disclaimer.

## How a Case Moves Through MetaTrial

```
submit_dispute()      → PARTICIPATION_OPEN   (claimant files; exact fee if configured)
respond_to_dispute()  → respondent adds their side (optional; silence is recorded)
trigger_arbitration() → review runs → VERDICT_ISSUED (AI consensus, in-transaction)
file_appeal()         → re-arbitration at heightened strictness (bond settled on outcome)
finalize()            → FINALIZED → attestation issued, registry mirrored
claim_settlement()    → permissionless on-chain delivery of any owed fee/bond movement
retry_mirror()        → permissionless recovery if the registry notification lags
```

Respondent participation is an **opportunity, not a gate** — arbitration proceeds regardless
when the window closes, and non-participation is documented and caps the verdict's
confidence. Windows (48h participation, 72h appeal by default) are governance-adjustable
between 1 hour and 7 days; skip requests take effect only with the respondent's explicit,
monotonic consent. If a round ends genuinely inconclusive, the protocol retries once and
records `INCONCLUSIVE_FINAL` — an honest terminal outcome, not an error.

## Three-Contract Architecture

| Contract | Responsibility | Relationship |
| --- | --- | --- |
| `metatrial_core` | Dispute engine and sole source of truth: lifecycle, arbitration, verdicts, attestations, fee/bond custody, on-chain settlement | Reads governance authorizations; writes an index pointer to the Registry. Never writes to Governance. |
| `metatrial_governance` | Admin multisig, propose→approve→timelock→execute pipeline, emergency pause, external-source whitelist | **Structurally incapable** of touching disputes, verdicts, or funds — it holds no dispute data and never calls Core. |
| `metatrial_attestation` | Lightweight verification index: ID mappings only (`attestation_id`, `dispute_id`, `external_ref`) | Pull-model: full data is fetched live from Core on demand; every registration is **independently verified against Core** before acceptance. |

The wiring between them — `core.set_governance_address()`, `core.set_registry_address()`,
`registry.set_core_address()` — is **one-time-only and permanently locked**. A trust anchor
that can be silently repointed is a standing backdoor around every other protection, so these
pointers, once set by the deployer, can never be changed by anyone again.

Governance authorizes; Core applies. An executed parameter or treasury proposal is only an
authorization record until Core itself pulls it via `apply_governance_action()` — Governance
has no code path that reaches Core's storage.

## Contract Reference

Every signature below is copied directly from the deployed source in [`contracts/`](./contracts),
not summarized from memory — parameter names, order, and types match exactly.

### `metatrial_core.py` — write methods

| Method | Purpose |
| --- | --- |
| `submit_dispute(respondent_address, title, category, dispute_context, external_ref, claimant_statement, cl_ev_type, cl_ev_content, cl_ev_hash, cl_ev_summary, claimant_requested_skip_participation, claimant_requested_skip_appeal, precedent_dispute_ids, external_precedent_urls) → str` | Files a new dispute; returns the assigned `dispute_id`. Pays the current filing fee if a treasury is configured, otherwise free. |
| `respond_to_dispute(dispute_id, respondent_statement, resp_ev_type, resp_ev_content, resp_ev_hash, resp_ev_summary, consent_skip_participation, consent_skip_appeal)` | Respondent's optional statement and evidence during the participation window. |
| `trigger_arbitration(dispute_id)` | Runs the AI consensus round in-transaction and stores the resulting verdict. |
| `file_appeal(dispute_id, ground_type, explanation, specific, impact, precedent_dispute_ids, external_precedent_urls)` | Challenges the current verdict on one of four typed grounds; escalates to a new, stricter arbitration round. |
| `finalize(dispute_id)` | Closes a dispute once the appeal window has lapsed or the appeal budget is exhausted; produces the on-chain `AttestationRecord` and queues the registry mirror. |
| `abandon_dispute(dispute_id)` | Claimant withdraws before arbitration begins. |
| `resolve_by_mutual_agreement(dispute_id)` | Both parties agree to close the case pre-verdict, without an AI determination. |
| `claim_settlement(settlement_id)` | Permissionless — delivers any already-authorized fee forfeiture or appeal-bond movement on-chain. Callable by anyone, any number of times; a repeat call on an already-delivered settlement is a safe no-op. |
| `retry_mirror(dispute_id)` | Permissionless — re-queues the registry notification if the original mirror after `finalize()` hasn't landed. |
| `set_registry_address(registry_addr)` | Owner-only, **one-time**. Wires Core to the Attestation Registry. |
| `set_governance_address(governance_addr)` | Owner-only, **one-time**. Wires Core to the Governance contract. |
| `propose_parameter_update(participation_window, appeal_window, max_appeal_rounds, confidence_tolerance, max_disputes_per_respondent_window, max_disputes_per_claimant_window)` | Owner-only bootstrap path for queuing a parameter change with a 24h timelock — usable only until a Governance contract is configured. |
| `apply_parameter_update()` | Applies a pending bootstrap parameter change once its timelock has elapsed. |
| `apply_governance_action(proposal_id)` | Permissionless — pulls an executed, timelocked Governance proposal (`CORE_PARAM_UPDATE` or `TREASURY_UPDATE`) into Core's own storage. |

### `metatrial_core.py` — key read methods

```
get_dispute(dispute_id)                       → full dispute state
get_verdict(dispute_id)                       → verdict + attestation_id
get_verdict_history(dispute_id)               → every round's verdict, cumulative
get_attestation(attestation_id)               → full attestation (core-local validity only)
get_ruling_code(dispute_id)                   → integer 0–4 (-1 if not final)
is_dispute_final(dispute_id)                  → bool
get_my_disputes(role, offset, limit)          → paginated dispute IDs for caller
get_disputes_by_address(address, role, offset, limit)
get_disputes_by_category(category, offset, limit)
get_settlement(settlement_id) / get_claim_status(settlement_id) / get_settlement_count()
get_governance_params()                       → active + pending params
get_protocol_info() / get_protocol_health()   → health includes contract_custodied_balance,
                                                 the contract's own on-chain balance self-check
```

### `metatrial_governance.py` — key methods

| Method | Purpose |
| --- | --- |
| `add_admin(new_admin_address)` / `transfer_admin_seat(new_admin_address)` | Bootstrap-only: single-operator phase for standing up the second admin seat / handing off the first. |
| `propose_add_admin(target)` / `propose_remove_admin(target)` | Multisig proposals to change the admin set (removal only possible from 4+ active admins, preserving the floor of 3). |
| `propose_core_param_update(participation_window, appeal_window, max_appeal_rounds, confidence_tolerance, max_disputes_per_respondent_window, max_disputes_per_claimant_window)` | Proposes new Core arbitration parameters, pulled into Core via `apply_governance_action()`. |
| `propose_treasury_update(dispute_filing_fee, appeal_bond_amount, treasury_address)` | Proposes the economic layer's fee, bond amount, and treasury destination. |
| `propose_external_source_update(source_prefix, active)` | Adds or deactivates a whitelisted external-precedent URL prefix. |
| `propose_pause()` / `propose_unpause()` | Proposes toggling the emergency pause (blocks new filings only). |
| `approve(proposal_id)` | One approval per admin per proposal; a proposer's own submission counts as their first. |
| `execute(proposal_id)` | Permissionless, exactly-once, only after threshold and timelock have both passed. |
| `get_proposal(proposal_id)` / `get_admins()` / `get_active_admin_count()` / `get_current_threshold()` | Read the live proposal and admin-set state. |
| `is_paused()` / `is_external_source_active(url)` | Live checks Core and the arbitration prompt rely on. |

### `metatrial_attestation.py` — registry methods

| Method | Purpose |
| --- | --- |
| `set_core_address(core_addr)` | Owner-only, **one-time**. Wires the registry to Core. |
| `register_finalized(attestation_id, dispute_id, external_ref)` | Permissionless — indexes a finalized dispute, but only after independently verifying the triple against Core's own record. |
| `revoke_attestation(attestation_id, reason)` | Owner-only, registry-local, permanent. |
| `attestation_exists(attestation_id)` | Fast local existence check. |
| `dispute_is_registered(dispute_id)` / `get_attestation_id_for_dispute(dispute_id)` | Local index lookups. |
| `get_finality_status(dispute_id)` | Returns `{status, attestation_id}` where `status` is one of `INDEXED`, `FINAL_PENDING_MIRROR`, or `NOT_FINAL` — resolves core/registry sync ambiguity in a single cross-contract round trip. |
| `get_attestation(attestation_id)` / `get_attestation_by_dispute(dispute_id)` / `get_attestation_by_external_ref(ref)` | Full attestation data, pulled live from Core. |
| `verify(attestation_id)` | The primary public-verification entry point — real, final, and currently valid, in one call. |
| `get_ruling_code(dispute_id)` | Integer ruling code, -1 on failure — the single call most integrations need. |
| `get_registry_info()` | Registry-wide stats: core address, configuration status, total registered/revoked. |

### Ruling Codes

```
0 = CLAIMANT_PREVAILS
1 = RESPONDENT_PREVAILS
2 = SPLIT_DECISION
3 = INCONCLUSIVE
4 = INCONCLUSIVE_FINAL
-1 = Not finalized yet
```

### Governance Defaults

```
Admin floor / ceiling:            3 / 5 active seats
Approval threshold:               2-of-3, 3-of-4, or 3-of-5 (scales with active count)
Approval window / timelock:       24h / 24h
Appeal rounds:                    2 (default); governance-adjustable 1–5, must be even (2 or 4 in practice)
Participation window:             48h (default); governance-adjustable 1h–7 days
Appeal window:                    72h (default); governance-adjustable 1h–7 days
Confidence equivalence tolerance: 15 points (default); governance-adjustable 5–30
Per-respondent dispute rate limit: 10 per rolling window
Per-claimant dispute rate limit:   20 per rolling window
Internal precedent citations:     up to 5 per submission/appeal
External precedent citations:     up to 2 per submission/appeal
Appeal ground minimum lengths:    explanation ≥ 80 chars · specific ≥ 60 · impact ≥ 40
```

### Integration in Five Lines

```javascript
// After a dispute is finalized in MetaTrial:
const isFinalized = await core.is_dispute_final(dispute_id);
if (!isFinalized) return;
const rulingCode  = await registry.get_ruling_code(dispute_id);
if (rulingCode === 0) releaseToClaimant();
if (rulingCode === 1) releaseToRespondent();
if (rulingCode === 2) splitRelease();
// If MetaTrial's own economic layer is configured for this dispute, any
// owed fee/bond settlement delivers independently via
// core.claim_settlement(settlement_id) — permissionless, callable by anyone.
```

## Reasoning & Evidence Model

- **Findings** normalize to a controlled vocabulary (`CONTRACT_BREACH`, `NO_BREACH_FOUND`,
  `MUTUAL_FAULT`, `INSUFFICIENT_EVIDENCE`, `CLAIMS_UNSUBSTANTIATED`,
  `PROCEDURAL_IRREGULARITY`), with ruling–finding coherence enforced both before and after
  consensus — an incoherent verdict is corrected before it is ever stored.
- **Confidence** (0–100) is derived from structural signals: supported-outcome status,
  finding-group coherence, retry/appeal-round position — with the model's own report
  contributing at most ±5 bounded points. A non-participating respondent caps the derivable
  confidence, preventing confidence farming via manufactured single-party disputes.
- **Evidence quality** is assessed per party (`STRONG`/`MODERATE`/`WEAK`/`ABSENT`), and
  evidence **integrity** means content-hash verification at arbitration time — stated exactly
  that way, never presented as independent authentication.
- **Internal precedent** — a party may cite up to five prior *finalized* MetaTrial disputes;
  only structured canonical fields (ruling, finding, remedy, confidence) flow to validators,
  never free text, and citations are re-verified live at arbitration time.
- **External precedent** — governance whitelists URL prefixes (legal reference sources); up
  to two may be cited per case, re-checked against the live whitelist immediately before
  fetching. Fetched content is truncated and hashed — an honest audit trail of what a
  validator actually saw.
- **Inconclusive handling** — one automatic retry per round; a second inconclusive result
  records `INCONCLUSIVE_FINAL`, auto-finalizes, and stands as a legitimate outcome.

Dispute categories: `CONTRACT`, `CONDUCT`, `CONTENT`, `PAYMENT`, `DELIVERY`,
`INTELLECTUAL_PROPERTY`, `CUSTOM`. Appeal grounds: `NEW_EVIDENCE`, `PROCEDURAL_ERROR`,
`EVIDENCE_INTEGRITY`, `REASONING_DEFECT`.

## Governance

Protocol parameters, the pause, the treasury, and the external-source whitelist are never
controlled by a single key:

- **Proposals** — any admin proposes one of seven action types; the creation act counts as
  the first approval, and a proposer can never approve their own proposal.
- **Approvals** — live-membership-tracked, one per admin, within a 24-hour window.
  Thresholds scale with the seat count (2-of-3, 3-of-4, 3-of-5; 3–5 seats total).
- **Timelock** — once threshold is reached, the proposal timelocks and any address may
  execute it (permissionless, exactly-once). `CORE_PARAM_UPDATE` and `TREASURY_UPDATE` are
  then **pulled into Core** by `apply_governance_action()` — governance authorizes, Core
  applies.
- **Administrative boundaries** — the pause gates new filings only; in-flight cases always
  continue. Governance cannot trap a dispute, alter a verdict, or touch custodied value.

## Security Architecture

MetaTrial's design reflects an adversarial hardening pass on top of its original
architecture, not just the original architecture with more features layered on. A few of the
decisions that came out of it:

- **Immutable trust anchors.** Core's pointer to Governance, Core's pointer to the
  Attestation Registry, and the Registry's pointer to Core are each set exactly once and then
  permanently locked. A re-settable trust anchor is a standing backdoor around every other
  protection the protocol has — so none of the three can ever be repointed again by anyone,
  including the original deployer.
- **Verification over trust in the registry.** `register_finalized()` is permissionless by
  design, so a failed automatic mirror can always be recovered by any willing party. Rather
  than trusting whatever triple a caller supplies, the Registry independently reads
  `core.view().get_attestation(attestation_id)` and confirms the dispute_id (and, if
  supplied, the external_ref) genuinely match Core's own record before accepting anything —
  closing off both fabricated registrations and a race condition an earlier duplicate-only
  check would have made permanent.
- **Governance cannot reach Core.** Governance holds no dispute data and makes no calls into
  Core, ever — it authorizes; Core independently reads and applies. This makes it
  structurally impossible for a governance action to directly touch a dispute's outcome, an
  evidentiary record, or a party's funds.
- **Deterministic execution as a first-class constraint.** No floating-point arithmetic
  anywhere in the codebase, no randomness, no wall-clock reads outside the platform's own
  timestamp accessor, and no contract-storage access from inside any non-deterministic
  closure — every value such a closure needs is captured as a plain local variable in the
  surrounding, deterministic code first.
- **Defense-in-depth on the economic layer.** `claim_settlement()` writes its
  delivery-confirmed state before attempting the actual transfer, closing off a reentrant
  double-claim. Every address that can become a destination for real funds is checked against
  the zero address before it can be set.
- **Fail-closed where it matters, fail-open where it must.** A failed cross-contract read
  guarding a *new* commitment (should a dispute be accepted, should a source be cited) fails
  closed. A failed read on a *recovery* path for something already, irreversibly decided (the
  registry-mirror retry) fails open — an unrelated contract's downtime should never
  permanently block a dispute that has already concluded.

## Finality & Verification

**Core finality and registry synchronization are separate facts.** A finalized case whose
registry mirror is still in flight is *final* — the UI must (and does) present it as "final —
verification index synchronizing," never as non-final. The Registry's `get_finality_status()`
resolves the distinction in one call: `INDEXED`, `FINAL_PENDING_MIRROR`, or `NOT_FINAL`.

The attestation registry is deliberately minimal: it stores ID mappings and pulls full data
from Core on demand. Its registration path is permissionless *and verified* — every
`(attestation_id, dispute_id, external_ref)` triple is checked against Core before it is
accepted, so even a raced or fabricated submission can never poison the index. Revocation is
registry-local and permanent, and the authoritative validity signal combines Core and
registry state.

Public verification at [`/verify`](https://metatrial.vercel.app/verify) accepts a **Case ID,
Attestation ID, or external reference**, requires no wallet, and answers three questions
directly: is this record real, is the determination final, and is the attestation currently
valid and indexed.

## Frontend Technical Architecture

- **Next.js 15** (App Router) · **React 19** · **TypeScript** — server-rendered shell,
  client-driven data
- **TanStack Query** — all contract state flows through queries; bounded reads (≤50/page), no
  continuous polling, invalidation after confirmed writes
- **genlayer-js 2.0.0-rc.1 + viem** — reads through a wallet-free client; writes through a
  wallet-bound client using the injected EIP-1193 provider directly (network ensure → submit
  → await consensus → confirm the actual outcome; a transaction hash alone is never treated
  as success)
- **Centralized configuration** — network (chain `61997`, RPC) and the three contract
  addresses live in `app/src/lib/config/protocol.json`; the UI never hard-codes
  governance-configurable values (windows, fees, thresholds, enums all come from reads)
- **Adapter boundary** — `src/lib/genlayer/` is the only code that talks to GenLayer,
  including live-verified decoding of contract errors (base64 receipt results → stable
  `ERR:*` codes → human language)

## Project Structure

```
metatrial-protocol/
├── README.md             ← this document
├── LICENSE                ← MIT
├── contracts/             ← protocol contract sources (authoritative; frontend does not modify them)
│   ├── metatrial_core.py
│   ├── metatrial_governance.py
│   └── metatrial_attestation.py
└── app/                   ← the Next.js frontend
    ├── scripts/compat-gate.mjs   ← live compatibility gate against the deployment
    └── src/
        ├── app/           ← routes: / · /cases · /explore · /verify · /my-cases · /governance
        ├── components/    ← landing, cases, verification, writes, governance UI
        └── lib/
            ├── config/    ← protocol.json: network + contract addresses (single source)
            ├── genlayer/  ← adapter: reads, writes, error decoding (the only SDK boundary)
            ├── metatrial/ ← typed domain models, mappers, human-state translation
            └── wallet/    ← injected EIP-1193 wallet + transaction tracking
```

## Running Locally

Requires Node 22 LTS and npm 10+.

```bash
git clone https://github.com/betheanalyst/metatrial-protocol.git
cd metatrial-protocol/app
npm install
npm run dev            # http://localhost:3000
npm run compat-gate    # live checks: SDK init · chain 61997 · contract reads · error surface
npm run typecheck && npm run lint && npm run test && npm run build
```

The frontend reads live from the deployed contracts listed in
[Deployed Contracts](#deployed-contracts) — no local contract deployment is required to run
the UI.

## Studio Devnet Configuration

| | |
| --- | --- |
| Network | GenLayer Studio Devnet |
| Chain ID | `61997` (`0xf22d`) |
| RPC | `https://studio-dev.genlayer.com/api` |
| Currency | GEN (18 decimals) |
| Explorer | `https://explorer-studio-dev.genlayer.com` |

Add the network to an injected wallet (Rabby or MetaMask) before writing. Public browsing and
verification never require one.

## Design & Product Philosophy

- **Case-first, not contract-first.** Protocol states translate into human states ("Waiting
  for participation", "Final determination") — raw state names stay behind progressive
  disclosure.
- **The reasoning chain is the product.** Determinations are presented as auditable arguments
  — never a winner badge; confidence is explicitly not a probability of truth.
- **Editorial, calm, precise.** No neon crypto aesthetic, no wallet-first layouts, no
  dashboard-first landing page. The interface is the record: disagreement progressively
  becoming evidence, reasoning, determination, and attestation.
- **Epistemic honesty is visible.** What MetaTrial does not know is stated plainly — evaluated
  evidence, not verified facts; inconclusive outcomes are legitimate results.
- **Wallets are action tools.** Browsing and verification work with no wallet; writes follow
  Review → Confirm → Process → Outcome → Next action, and a transaction hash is never mistaken
  for success.

## Current Status & Limitations

- **Studio Devnet deployment** — the contracts and UI run on GenLayer's Studio Devnet (test
  network, test GEN). Fees are currently unconfigured (filing and appeals are free) until
  governance authorizes a treasury.
- **Browser-wallet writes** — signing requires an injected wallet on Studio Devnet; every
  write ensures the network first and surfaces contract rejections in plain language.
- **Recency is index-honest** — the contracts expose per-category indexes rather than a
  global feed; Explore derives "recent" from category tails and says so.
- **Precedent exploration** — citing precedent is live in the protocol; a discovery UI over
  the precedent corpus is future work.
- **Governance proposal creation** is UI-supported and admin-gated; ordinary users can never
  reach it.
- **Respondent evidence content is not exposed by `get_dispute()`.** The view currently
  returns claimant evidence in full (`claimant_ev_type`, `claimant_ev_content`,
  `claimant_ev_hash`) but only `respondent_ev_type` and `respondent_ev_hash` for the
  respondent's side — `respondent_ev_content` is never included in the returned dict. This
  is an oversight, not a deliberate privacy design: `get_dispute()`'s own docstring describes
  it as the "full dispute record" and disputes generally as "public on-chain." The UI
  surfaces this plainly (*"The evidence content itself is not exposed by the contract
  view"*) rather than showing a blank or broken field. A fix — mirroring the claimant's
  exposed fields exactly — is planned for the next contract version; because it changes
  Core's read interface, it requires a redeployment rather than a hot patch.

## Contributing

Issues and pull requests are welcome. Contract sources in [`contracts/`](./contracts) are the
protocol's authoritative logic — changes there should include reasoning for why a given
invariant (immutable trust anchors, registry verification-over-trust, deterministic-execution
constraints) is preserved, not just that tests pass. Frontend contributions should keep the
adapter boundary intact: all GenLayer reads and writes go through `app/src/lib/genlayer/`, and
governance-configurable values are always read live, never hard-coded.

## License

MetaTrial is released under the [MIT License](./LICENSE).

## Disclaimer

MetaTrial evaluates submitted evidence; it does not investigate objective reality. A forged
document that appears authentic may deceive an AI validator just as it might deceive a human
arbitrator. Every verdict, attestation, and registry record carries the same
`basis_of_determination` statement: *this determination reflects solely the evidence
submitted to the MetaTrial protocol; MetaTrial does not independently verify the
authenticity, accuracy, or completeness of submitted evidence.*

MetaTrial is not a court and has no legal standing in any jurisdiction unless parties
voluntarily adopt its verdicts as binding. It currently runs on a test network with test GEN
— nothing described here should be treated as handling real economic value until stated
otherwise.

---

<div align="center">

*MetaTrial is built on GenLayer — the first blockchain designed natively for AI.*
*Three contracts. One trust model. Governed, verified, and audited at every boundary.*

</div>
