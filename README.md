# MetaTrial

**Credibility without coercion.**

MetaTrial is an AI-native decentralized arbitration protocol built on GenLayer. Any two
parties in a digital relationship — a freelancer and a client, a buyer and a seller, a DAO
and its contributor — can submit a dispute. Independent AI validators reason over the
submitted evidence, informed where relevant by the protocol's own accumulated precedent.
What comes out is not a score or a vote count: it is a **structured, reasoned, auditable
determination** — ruling, findings, confidence, evidence assessments, plain-language
reasoning, and a recommended resolution — recorded immutably on-chain and, once final,
attested for anyone to verify.

MetaTrial is not a substitute for courts, and it does not pretend to have the authority of
law. What it offers for the disputes the existing system fails — cross-border, too small to
litigate, too fast-moving to wait months — is something different: a verifiably reasoned
determination that any platform may choose to act on. **The attestation is the product.**
What platforms do with it is their decision.

---

## The Problem

Millions of digital transactions fail every day, and the recourse landscape fails with
them:

- **Platform arbitration** is opaque and inconsistent. Decisions cannot be verified,
  reasoned about, or exported. You trust the platform and never see how it decided.
- **Legal action** works only for disputes large enough to justify the economics — fees,
  jurisdictions, timelines measured in months. For most digital-native disputes it is
  simply inaccessible.
- **Absorbing the loss** is the most common outcome. The dispute goes unresolved and the
  ecosystem becomes slightly less trustworthy.

Earlier on-chain dispute systems — typically human juror voting pools — improved on this,
but carry their own structural limits: juror expertise varies, verdicts arrive **without a
reasoning chain** (a number, not an argument), coordination is slow, and outcomes are
forced into binary win/lose molds that discard the nuance real disputes contain.

MetaTrial addresses all four: validators reason rather than merely vote, every verdict
ships with its full auditable argument, arbitration runs at validator speed, and the
verdict schema carries structured remedies — partial payment at a percentage, conditional
delivery — rather than a binary outcome.

## The MetaTrial Approach

A case on MetaTrial is a record that grows:

- **Case** — a claimant files unilaterally (arbitration is a claimant right), naming a
  respondent, a category, a statement, and an optional external reference linking the case
  to a platform's own case ID.
- **Evidence** — one submission per party, as inline text, a **content-addressed URL**
  (IPFS/Arweave, so silent substitution is cryptographically impossible), or a file
  reference with summary. The content hash travels with the evidence and is re-verified at
  arbitration time by every validator that fetches it.
- **Reasoning** — the heart of the protocol. Validators do not score; they reason. Every
  verdict carries its reasoning chain, and the model's raw, pre-normalization finding text
  is retained verbatim alongside the canonical value so an auditor can always see what the
  protocol recorded *and* what the model actually said.
- **Determination** — a ruling (`CLAIMANT_PREVAILS`, `RESPONDENT_PREVAILS`,
  `SPLIT_DECISION`, `INCONCLUSIVE`, `INCONCLUSIVE_FINAL`), a contract-derived confidence
  (never AI self-reported), a primary finding from a controlled vocabulary, three key
  findings, evidence quality for both parties, and a structured recommended resolution
  with type, percentage, detail, and conditions.
- **Challenge** — either party can appeal on four typed grounds (new evidence, procedural
  error, evidence integrity, reasoning defect), each demanding substantively populated
  explanation, specificity, and impact. Prior rounds are never erased: the decision
  history preserves every verdict, superseded ones included.
- **Final record** — after the appeal window closes (or the budget is exhausted, or both
  parties waived appeals), the case is sealed and an attestation is issued.
- **Attestation** — the portable, verifiable artifact: attestation ID, case ID, final
  determination, ruling code, issued time, appeal rounds, participation, and the epistemic
  basis. Anyone can verify it — no wallet required.

## Built on GenLayer

MetaTrial runs as **Intelligent Contracts**: each method executes across multiple
independent validator nodes, and GenLayer's equivalence consensus decides whether their
outputs agree. This is what makes AI-mediated reasoning auditable rather than oracular.

- **Optimistic, equivalence-based consensus.** Every validator independently runs the
  arbitration routine — building the prompt, fetching evidence and precedent, calling the
  model — and the outputs must be *equivalent*, not identical. Ruling is a **hard gate**
  (different rulings are never equivalent). The finding maps to canonical equivalence
  groups (a **strong signal**). Confidence is a **soft signal** tolerated within a
  governance-adjusted band (15 points by default). This anchors consensus on what matters
  while absorbing natural LLM variation.
- **A stripped evaluator.** The equivalence evaluator sees only three fields — ruling,
  finding group, confidence. The full verdict, including all reasoning, is deliberately
  kept out of its view. Extending what the AI can be shown has never been allowed to
  extend what a compromised input could influence: every piece of untrusted content —
  statements, evidence, precedent — is delimited and marked non-authoritative in the
  prompt, with explicit injection-resistance instructions.
- **Deterministic where it must be.** Confidence is derived by the contract with
  integer-only arithmetic from structural signals — never floating-point, never
  self-reported. Anything non-deterministic (model calls, URL fetching) lives inside pure
  closures that touch no contract storage.
- **Epistemic honesty.** Every verdict, attestation, and registry record carries the same
  statement: *this determination reflects solely the evidence submitted; MetaTrial does
  not independently verify its authenticity, accuracy, or completeness.* That honesty is
  the design, not a disclaimer.

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

Respondent participation is an **opportunity, not a gate** — arbitration proceeds
regardless when the window closes, and non-participation is documented and caps the
verdict's confidence. Windows (48h participation, 72h appeal by default) are
governance-adjustable; skip requests take effect only with the respondent's explicit,
monotonic consent. If a round ends genuinely inconclusive, the protocol retries once and
records `INCONCLUSIVE_FINAL` — an honest terminal outcome, not an error.

## Three-Contract Architecture

| Contract | Responsibility | Relationship |
| --- | --- | --- |
| `metatrial_core` | Dispute engine and sole source of truth: lifecycle, arbitration, verdicts, attestations, fee/bond custody, on-chain settlement | Reads governance authorizations; writes an index pointer to the Registry. Never writes to Governance. |
| `metatrial_governance` | Admin multisig, propose→approve→timelock→execute pipeline, emergency pause, external-source whitelist | **Structurally incapable** of touching disputes, verdicts, or funds — it holds no dispute data and never calls Core. |
| `metatrial_attestation` | Lightweight verification index: ID mappings only (`attestation_id`, `dispute_id`, `external_ref`) | Pull-model: full data is fetched live from Core on demand; every registration is **independently verified against Core** before acceptance. |

The wiring between them (`core.set_governance_address`, `core.set_registry_address`,
`registry.set_core_address`) is **one-time-only and permanently locked**. A trust anchor
that can be silently repointed is a standing backdoor around every other protection — so
these pointers, once set by the deployer, can never be changed by anyone again.

Governance authorizes; Core applies. An executed parameter or treasury proposal is only an
authorization record until Core itself pulls it via `apply_governance_action()` —
Governance has no code path that reaches Core's storage.

## Reasoning & Evidence Model

- **Findings** normalize to a controlled vocabulary (`CONTRACT_BREACH`,
  `NO_BREACH_FOUND`, `MUTUAL_FAULT`, `INSUFFICIENT_EVIDENCE`, `CLAIMS_UNSUBSTANTIATED`,
  `PROCEDURAL_IRREGULARITY`), with ruling–finding coherence enforced both before and after
  consensus — an incoherent verdict is corrected before it is ever stored.
- **Confidence** (0–100) is derived from structural signals: supported-outcome status,
  finding-group coherence, retry/appeal-round position — with the model's own report
  contributing at most ±5 bounded points. A non-participating respondent caps the
  derivable confidence, preventing confidence farming via manufactured single-party
  disputes.
- **Evidence quality** is assessed per party (`STRONG`/`MODERATE`/`WEAK`/`ABSENT`), and
  evidence **integrity** means content-hash verification at arbitration time — stated
  exactly that way, never presented as independent authentication.
- **Internal precedent** — a party may cite up to five prior *finalized* MetaTrial
  disputes; only structured canonical fields (ruling, finding, remedy, confidence) flow to
  validators, never free text, and citations are re-verified live at arbitration time.
- **External precedent** — governance whitelists URL prefixes (legal reference sources);
  up to two may be cited per case, re-checked against the live whitelist immediately
  before fetching. Fetched content is truncated and hashed — an honest audit trail of what
  a validator actually saw.
- **Inconclusive handling** — one automatic retry per round; a second inconclusive result
  records `INCONCLUSIVE_FINAL`, auto-finalizes, and stands as a legitimate outcome.

## Governance

Protocol parameters, the pause, the treasury, and the external-source whitelist are never
controlled by a single key:

- **Proposals** — any admin proposes one of seven action types; the creation act counts as
  the first approval, and a proposer can never approve their own proposal.
- **Approvals** — live-membership-tracked, one per admin, within a 24-hour window.
  Thresholds scale with the seat count (2-of-3, 3-of-4, 3-of-5; 3–5 seats total).
- **Timelock** — once threshold is reached, the proposal timelocks and any address may
  execute it (permissionless, exactly-once). CORE_PARAM_UPDATE and TREASURY_UPDATE are
  then **pulled into Core** by `apply_governance_action()` — governance authorizes, Core
  applies.
- **Administrative boundaries** — the pause gates new filings only; in-flight cases always
  continue. Governance cannot trap a dispute, alter a verdict, or touch custodied value.

## Finality & Verification

**Core finality and registry synchronization are separate facts.** A finalized case whose
registry mirror is still in flight is *final* — the UI must (and does) present it as
"final — verification index synchronizing," never as non-final. The Registry's
`get_finality_status()` resolves the distinction in one call: `INDEXED`,
`FINAL_PENDING_MIRROR`, or `NOT_FINAL`.

The attestation registry is deliberately minimal: it stores ID mappings and pulls full data
from Core on demand. Its registration path is permissionless *and verified* — every
`(attestation_id, dispute_id, external_ref)` triple is checked against Core before it is
accepted, so even a raced or fabricated submission can never poison the index. Revocation
is registry-local and permanent, and the authoritative validity signal combines Core and
registry state.

Public verification at `/verify` accepts a **Case ID, Attestation ID, or external
reference**, requires no wallet, and answers three questions directly: is this record
real, is the determination final, and is the attestation currently valid and indexed.

## Technical Architecture

- **Next.js 15** (App Router) · **React 19** · **TypeScript** — server-rendered shell,
  client-driven data
- **TanStack Query** — all contract state flows through queries; bounded reads (≤50/page),
  no continuous polling, invalidation after confirmed writes
- **genlayer-js 2.0.0-rc.1 + viem** — reads through a wallet-free client; writes through a
  wallet-bound client using the injected EIP-1193 provider directly (network ensure →
  submit → await consensus → confirm the actual outcome; a transaction hash alone is never
  treated as success)
- **Centralized configuration** — network (chain `61997`, RPC) and the three contract
  addresses live in `app/src/lib/config/protocol.json`; the UI never hard-codes
  governance-configurable values (windows, fees, thresholds, enums all come from reads)
- **Adapter boundary** — `src/lib/genlayer/` is the only code that talks to GenLayer,
  including live-verified decoding of contract errors (base64 receipt results → stable
  `ERR:*` codes → human language)

## Project Structure

```
metatrial protocol/
├── README.md            ← this document
├── contracts/           ← contracts/ ← protocol contract sources (authoritative; frontend does not modify them)
└── app/                 ← the Next.js frontend
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

Node 22 LTS, npm 10+.

```bash
cd app
npm install
npm run dev            # http://localhost:3000
npm run compat-gate    # live checks: SDK init · chain 61997 · contract reads · error surface
npm run typecheck && npm run lint && npm run test && npm run build
```

## Studio Devnet Configuration

| | |
| --- | --- |
| Network | GenLayer Studio Devnet |
| Chain ID | `61997` (`0xf22d`) |
| RPC | `https://studio-dev.genlayer.com/api` |
| Currency | GEN (18 decimals) |
| Explorer | `https://explorer-studio-dev.genlayer.com` |

Add the network to an injected wallet (Rabby or MetaMask) before writing. Public browsing
and verification never require one.

## Design & Product Philosophy

- **Case-first, not contract-first.** Protocol states translate into human states
  ("Waiting for participation", "Final determination") — raw state names stay behind
  progressive disclosure.
- **The reasoning chain is the product.** Determinations are presented as auditable
  arguments — never a winner badge; confidence is explicitly not a probability of truth.
- **Editorial, calm, precise.** No neon crypto aesthetic, no wallet-first layouts, no
  dashboard-first landing page. The interface is the record: disagreement progressively
  becoming evidence, reasoning, determination, and attestation.
- **Epistemic honesty is visible.** What MetaTrial does not know is stated plainly —
  evaluated evidence, not verified facts; inconclusive outcomes are legitimate results.
- **Wallets are action tools.** Browsing and verification work with no wallet; writes
  follow Review → Confirm → Process → Outcome → Next action, and a transaction hash is
  never mistaken for success.

## Current Status & Limitations

- **Studio Devnet deployment** — the contracts and UI run on GenLayer's Studio Devnet
  (test network, test GEN). Fees are currently unconfigured (filing and appeals are free)
  until governance authorizes a treasury.
- **Browser-wallet writes** — signing requires an injected wallet on Studio Devnet; every
  write ensures the network first and surfaces contract rejections in plain language.
- **Recency is index-honest** — the contracts expose per-category indexes rather than a
  global feed; Explore derives "recent" from category tails and says so.
- **Precedent exploration** — citing precedent is live in the protocol; a discovery UI
  over the precedent corpus is future work.
- **Governance proposal creation** is UI-supported and admin-gated; ordinary users can
  never reach it.

---

*MetaTrial is built on GenLayer — the first blockchain designed natively for AI.*
*Three contracts. One trust model. Governed, verified, and audited at every boundary.*
