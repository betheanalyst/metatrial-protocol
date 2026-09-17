"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  disputeExists,
  getLastDisputeId,
  getDisputeStatus,
  getProtocolHealth,
  isExternalSourceActive,
} from "@/lib/genlayer/reads";
import {
  submitDispute,
  toBigIntSafe,
  type SubmitDisputeInput,
  type WriteOutcome,
} from "@/lib/genlayer/writes";
import { getInjectedProvider } from "@/lib/wallet/injected";
import {
  useExternalSourceWhitelist,
  WhitelistBadge,
} from "@/lib/metatrial/use-external-whitelist";
import { formatGenAmount } from "@/lib/utils/format";
import { useProtocolInfo } from "@/lib/metatrial/queries";
import { categoryLabel } from "@/lib/metatrial/labels";
import { useWallet } from "@/lib/wallet/wallet-context";
import { cn } from "@/lib/utils/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { TransactionFlow } from "@/components/writes/transaction-flow";

const LIMITS = {
  title: 200,
  statement: 3000,
  context: 500,
  externalRef: 128,
  inline: 6000,
  hash: 128,
  summary: 1000,
  summaryMin: 50,
  externalUrl: 1000,
  precedents: 5,
  externalUrls: 2,
};

type EvidenceType = "INLINE_TEXT" | "URL" | "FILE_REFERENCE";

interface FormState {
  category: string;
  respondent: string;
  title: string;
  context: string;
  externalRef: string;
  statement: string;
  evidenceType: EvidenceType;
  evidenceContent: string;
  evidenceHash: string;
  evidenceSummary: string;
  precedentIds: string;
  externalUrls: string;
  requestedSkipParticipation: boolean;
  requestedSkipAppeal: boolean;
  acknowledged: boolean;
}

const initialState: FormState = {
  category: "",
  respondent: "",
  title: "",
  context: "",
  externalRef: "",
  statement: "",
  evidenceType: "INLINE_TEXT",
  evidenceContent: "",
  evidenceHash: "",
  evidenceSummary: "",
  precedentIds: "",
  externalUrls: "",
  requestedSkipParticipation: false,
  requestedSkipAppeal: false,
  acknowledged: false,
};

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      {children}
      {hint !== undefined && error === undefined ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
      {error !== undefined ? (
        <p className="mt-1 text-xs text-status-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-attest focus:outline-none";

export function FileCaseForm() {
  const router = useRouter();
  const wallet = useWallet();
  const protocolInfo = useProtocolInfo();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setWhitelist] = useState<Record<string, boolean>>({});
  const liveWhitelist = useExternalSourceWhitelist(parseList(form.externalUrls));

  const categories = protocolInfo.data?.valid_categories ?? [];
  const immutablePrefixes = protocolInfo.data?.immutable_url_prefixes ?? [];
  const effectiveCategory = form.category === "" ? (categories[0] ?? "") : form.category;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (prev[key] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateStep1(): boolean {
    const next: Record<string, string> = {};
    if (isAddress(form.respondent.trim()) === false) {
      next.respondent = "Enter the respondent's wallet address (0x\u2026).";
    } else if (
      wallet.address !== null &&
      form.respondent.trim().toLowerCase() === wallet.address.toLowerCase()
    ) {
      next.respondent =
        "A case cannot be filed against your own address - enter the other party's wallet address.";
    }
    if (form.title.trim() === "" || form.title.length > LIMITS.title) {
      next.title = `The title is required and limited to ${LIMITS.title} characters.`;
    }
    if (form.context.length > LIMITS.context) {
      next.context = `Neutral context is limited to ${LIMITS.context} characters.`;
    }
    if (form.externalRef.length > LIMITS.externalRef) {
      next.externalRef = `External reference is limited to ${LIMITS.externalRef} characters.`;
    }
    if (form.statement.trim() === "" || form.statement.length > LIMITS.statement) {
      next.statement = `Your statement is required and limited to ${LIMITS.statement} characters.`;
    }
    if (form.evidenceType === "INLINE_TEXT") {
      if (form.evidenceContent.trim() === "") {
        next.evidenceContent = "Inline evidence content is required.";
      } else if (form.evidenceContent.length > LIMITS.inline) {
        next.evidenceContent = `Inline evidence is limited to ${LIMITS.inline} characters.`;
      }
      if (form.evidenceSummary.length > LIMITS.summary) {
        next.evidenceSummary = `Summary is limited to ${LIMITS.summary} characters.`;
      }
    } else {
      if (form.evidenceContent.trim() === "") {
        next.evidenceContent = "The content-addressed URL is required.";
      } else {
        const prefixOk = immutablePrefixes.some((prefix) =>
          form.evidenceContent.startsWith(prefix),
        );
        if (prefixOk === false) {
          next.evidenceContent =
            "URL evidence must use content-addressed storage: " +
            "ipfs://, ar://, or an IPFS/Arweave gateway URL.";
        }
      }
      if (form.evidenceHash.trim() === "") {
        next.evidenceHash = "The content hash (CID or Arweave TX ID) is required.";
      } else if (form.evidenceHash.length > LIMITS.hash) {
        next.evidenceHash = `The content hash is limited to ${LIMITS.hash} characters.`;
      }
      if (form.evidenceType === "FILE_REFERENCE") {
        if (form.evidenceSummary.trim().length < LIMITS.summaryMin) {
          next.evidenceSummary = `A summary of at least ${LIMITS.summaryMin} characters is required for file references.`;
        } else if (form.evidenceSummary.length > LIMITS.summary) {
          next.evidenceSummary = `Summary is limited to ${LIMITS.summary} characters.`;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: Record<string, string> = {};
    const precedents = parseList(form.precedentIds);
    if (precedents.length > LIMITS.precedents) {
      next.precedentIds = `At most ${LIMITS.precedents} precedent cases can be cited.`;
    }
    for (const id of precedents) {
      if (/^MT-\d{8}-[0-9a-fA-F]{8}$/.test(id) === false) {
        next.precedentIds = "Precedent case IDs look like MT-00000012-1a2b3c4d.";
        break;
      }
    }
    const urls = parseList(form.externalUrls);
    if (urls.length > LIMITS.externalUrls) {
      next.externalUrls = `At most ${LIMITS.externalUrls} external sources can be cited.`;
    }
    for (const url of urls) {
      if (url.length > LIMITS.externalUrl) {
        next.externalUrls = `External source URLs are limited to ${LIMITS.externalUrl} characters.`;
        break;
      }
      if (/^https:\/\//.test(url) === false) {
        next.externalUrls = "External source URLs must use https://";
        break;
      }
    }
    if (form.acknowledged === false) {
      next.acknowledged =
        "Please acknowledge that everything submitted becomes part of the public record.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function checkExternalWhitelist(): Promise<boolean> {
    const urls = parseList(form.externalUrls);
    if (urls.length === 0) {
      return true;
    }
    const results: Record<string, boolean> = {};
    for (const url of urls) {
      try {
        results[url] = await isExternalSourceActive(url);
      } catch {
        results[url] = false;
      }
    }
    setWhitelist(results);
    const blocked = urls.filter((url) => results[url] === false);
    if (blocked.length > 0) {
      setErrors((prev) => ({
        ...prev,
        externalUrls:
          "Some external sources are not on the governance whitelist and would be rejected: " +
          blocked.join(", "),
      }));
      return false;
    }
    return true;
  }

  function buildInput(): SubmitDisputeInput {
    return {
      respondentAddress: form.respondent.trim(),
      title: form.title.trim(),
      category: effectiveCategory,
      disputeContext: form.context.trim(),
      externalRef: form.externalRef.trim(),
      claimantStatement: form.statement.trim(),
      evidenceType: form.evidenceType,
      evidenceContent:
        form.evidenceType === "INLINE_TEXT" ? form.evidenceContent : form.evidenceContent.trim(),
      evidenceHash: form.evidenceType === "INLINE_TEXT" ? "" : form.evidenceHash.trim(),
      evidenceSummary: form.evidenceSummary,
      requestedSkipParticipation: form.requestedSkipParticipation,
      requestedSkipAppeal: form.requestedSkipAppeal,
      precedentDisputeIds: parseList(form.precedentIds),
      externalPrecedentUrls: parseList(form.externalUrls),
    };
  }

  if (wallet.hasProvider === false || wallet.status !== "connected") {
    return (
      <div className="rounded-xl border border-line bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-ink">A wallet is needed to file a case.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Filing places a case on the public record, so it is signed with your
          wallet. Browsing and verification never need one.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <ButtonLink href="/cases" variant="secondary">
            Browse cases instead
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Filing steps">
        {[
          [1, "Case & evidence"],
          [2, "Precedent & options"],
          [3, "Review & submit"],
        ].map(([value, label]) => (
          <li
            key={value}
            className={cn(
              "rounded-full border px-3 py-1",
              step === value
                ? "border-attest bg-attest text-paper"
                : "border-line bg-white text-muted",
            )}
          >
            Step {value} - {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-6 rounded-2xl border border-line bg-white px-6 py-6">
          <Field label="Category" error={errors.category}>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => {
                    update("category", entry);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    effectiveCategory === entry
                      ? "border-attest bg-attest text-paper"
                      : "border-line text-muted hover:border-ink/40 hover:text-ink",
                  )}
                >
                  {categoryLabel(entry)}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Respondent address"
            hint="The wallet address of the party the case is against."
            error={errors.respondent}
          >
            <input
              value={form.respondent}
              onChange={(event) => {
                update("respondent", event.target.value);
              }}
              placeholder="0x\u2026"
              spellCheck={false}
              className={cn(inputClass, "font-mono")}
            />
          </Field>

          <Field label="Case title" error={errors.title}>
            <input
              value={form.title}
              onChange={(event) => {
                update("title", event.target.value);
              }}
              maxLength={LIMITS.title}
              className={inputClass}
            />
          </Field>

          <Field
            label="Neutral context (optional)"
            hint={`A short, neutral framing of the situation (${LIMITS.context} characters max).`}
            error={errors.context}
          >
            <textarea
              value={form.context}
              onChange={(event) => {
                update("context", event.target.value);
              }}
              rows={2}
              maxLength={LIMITS.context}
              className={inputClass}
            />
          </Field>

          <Field
            label="Your statement"
            hint={`What happened, in your own words (1 to ${LIMITS.statement} characters).`}
            error={errors.statement}
          >
            <textarea
              value={form.statement}
              onChange={(event) => {
                update("statement", event.target.value);
              }}
              rows={5}
              maxLength={LIMITS.statement}
              className={inputClass}
            />
          </Field>

          <Field label="External reference (optional)" error={errors.externalRef}>
            <input
              value={form.externalRef}
              onChange={(event) => {
                update("externalRef", event.target.value);
              }}
              placeholder="A platform case ID, ticket, or order number"
              maxLength={LIMITS.externalRef}
              className={inputClass}
            />
          </Field>

          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Your evidence
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["INLINE_TEXT", "Inline text"],
                  ["URL", "Content-addressed URL"],
                  ["FILE_REFERENCE", "File reference"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    update("evidenceType", value);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    form.evidenceType === value
                      ? "border-attest bg-attest text-paper"
                      : "border-line text-muted hover:border-ink/40 hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {form.evidenceType === "INLINE_TEXT" ? (
                <Field
                  label="Evidence text"
                  hint={`Up to ${LIMITS.inline} characters. Optional summary below.`}
                  error={errors.evidenceContent}
                >
                  <textarea
                    value={form.evidenceContent}
                    onChange={(event) => {
                      update("evidenceContent", event.target.value);
                    }}
                    rows={4}
                    maxLength={LIMITS.inline}
                    className={inputClass}
                  />
                </Field>
              ) : (
                <>
                  <Field
                    label="Content-addressed URL"
                    hint="Only immutable IPFS/Arweave URLs are accepted, so evidence cannot be silently changed."
                    error={errors.evidenceContent}
                  >
                    <input
                      value={form.evidenceContent}
                      onChange={(event) => {
                        update("evidenceContent", event.target.value);
                      }}
                      placeholder="ipfs://\u2026 or https://arweave.net/\u2026"
                      spellCheck={false}
                      className={cn(inputClass, "font-mono text-xs")}
                    />
                  </Field>
                  <Field
                    label="Content hash"
                    hint="The CID or Arweave transaction ID for this evidence."
                    error={errors.evidenceHash}
                  >
                    <input
                      value={form.evidenceHash}
                      onChange={(event) => {
                        update("evidenceHash", event.target.value);
                      }}
                      spellCheck={false}
                      className={cn(inputClass, "font-mono text-xs")}
                    />
                  </Field>
                </>
              )}
              {form.evidenceType === "FILE_REFERENCE" ? (
                <Field
                  label="Summary"
                  hint={`Required for file references (${LIMITS.summaryMin} to ${LIMITS.summary} characters).`}
                  error={errors.evidenceSummary}
                >
                  <textarea
                    value={form.evidenceSummary}
                    onChange={(event) => {
                      update("evidenceSummary", event.target.value);
                    }}
                    rows={3}
                    className={inputClass}
                  />
                </Field>
              ) : (
                <Field
                  label="Evidence summary (optional)"
                  hint={`A short description of what this evidence shows (${LIMITS.summary} characters max).`}
                  error={errors.evidenceSummary}
                >
                  <input
                    value={form.evidenceSummary}
                    onChange={(event) => {
                      update("evidenceSummary", event.target.value);
                    }}
                    maxLength={LIMITS.summary}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (validateStep1() === true) {
                  setStep(2);
                }
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6 rounded-2xl border border-line bg-white px-6 py-6">
          <Field
            label="Precedent cases (optional)"
            hint={`Up to ${LIMITS.precedents} finalized MetaTrial cases, comma-separated. Only structured fields (ruling, finding, remedy) are ever shown to the review - never statements or evidence.`}
            error={errors.precedentIds}
          >
            <input
              value={form.precedentIds}
              onChange={(event) => {
                update("precedentIds", event.target.value);
              }}
              placeholder="MT-00000004-99998888, MT-00000007-aabbccdd"
              spellCheck={false}
              className={cn(inputClass, "font-mono text-xs")}
            />
          </Field>

          <Field
            label="External precedent sources (optional)"
            hint={`Up to ${LIMITS.externalUrls} URLs, one per line. Each must be covered by an active governance whitelist entry and is re-checked at arbitration time.`}
            error={errors.externalUrls}
          >
            <textarea
              value={form.externalUrls}
              onChange={(event) => {
                update("externalUrls", event.target.value);
              }}
              rows={2}
              spellCheck={false}
              className={cn(inputClass, "font-mono text-xs")}
            />
            <ul className="mt-2 space-y-1">
              {parseList(form.externalUrls).map((url) => (
                <li key={url} className="flex flex-wrap items-center gap-2 text-xs">
                  <WhitelistBadge state={liveWhitelist.get(url)} />
                  <span className="break-all font-mono text-muted">{url}</span>
                </li>
              ))}
            </ul>
          </Field>

          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Participation options
            </legend>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.requestedSkipParticipation}
                  onChange={(event) => {
                    update("requestedSkipParticipation", event.target.checked);
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Request to skip the participation window.</span>{" "}
                  <span className="text-muted">
                    This is only a request - it takes effect only if the
                    respondent explicitly agrees. Otherwise the full window
                    applies.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.requestedSkipAppeal}
                  onChange={(event) => {
                    update("requestedSkipAppeal", event.target.checked);
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Request to skip appeals.</span>{" "}
                  <span className="text-muted">
                    Also requires the respondent&apos;s explicit consent - silence
                    is never treated as agreement.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-xl border border-status-pending/40 bg-status-pending/10 px-4 py-4 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.acknowledged}
              onChange={(event) => {
                update("acknowledged", event.target.checked);
              }}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Public record acknowledgment.</span>{" "}
              Everything submitted here - statements, evidence, and references -
              becomes part of a public, on-chain record that anyone can read.
              Do not include sensitive personal, commercial, or legally
              privileged material.
            </span>
          </label>
          {errors.acknowledged !== undefined ? (
            <p className="text-xs text-status-danger" role="alert">
              {errors.acknowledged}
            </p>
          ) : null}

          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(1);
              }}
            >
              Back
            </Button>
            <Button
              onClick={() => {
                if (validateStep2() === true) {
                  void checkExternalWhitelist().then((ok) => {
                    if (ok === true) {
                      setStep(3);
                    }
                  });
                }
              }}
            >
              Review the case
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <FilingReview
          input={buildInput()}
          effectiveCategory={effectiveCategory}
          onBack={() => {
            setStep(2);
          }}
          onFiled={(disputeId) => {
            router.push(`/cases/${disputeId}`);
          }}
        />
      ) : null}
    </div>
  );
}

function FilingReview({
  input,
  effectiveCategory,
  onBack,
  onFiled,
}: {
  input: SubmitDisputeInput;
  effectiveCategory: string;
  onBack: () => void;
  onFiled: (disputeId: string) => void;
}) {
  const wallet = useWallet();
  const [feeUnavailable, setFeeUnavailable] = useState(false);

  const healthQuery = useQuery({
    queryKey: ["metatrial", "protocol-health"],
    queryFn: getProtocolHealth,
    staleTime: 15_000,
  });

  const filingFeeWei = useMemo(() => {
    const health = healthQuery.data;
    if (health === undefined) {
      return null;
    }
    if (health.treasury_address === "") {
      return 0n;
    }
    try {
      return toBigIntSafe(health.dispute_filing_fee);
    } catch {
      return null;
    }
  }, [healthQuery.data]);

  const evidenceLine =
    input.evidenceType === "INLINE_TEXT"
      ? "Inline text"
      : input.evidenceType === "URL"
        ? "Content-addressed URL + content hash"
        : "File reference + content hash + summary";

  async function run(): Promise<WriteOutcome> {
    if (wallet.address === null || filingFeeWei === null) {
      setFeeUnavailable(true);
      return {
        status: "failed",
        primary:
          "The filing fee could not be confirmed right now. Refresh the page and try again.",
        raw: null,
        hash: null,
      };
    }
    // Re-read the fee immediately before signing to minimize the window in
    // which governance could change it (exact-amount enforcement).
    let fee = filingFeeWei;
    try {
      const fresh = await getProtocolHealth();
      fee = fresh.treasury_address === "" ? 0n : toBigIntSafe(fresh.dispute_filing_fee);
    } catch {
      /* keep the snapshot fee */
    }
    const outcome = await submitDispute({
      walletAddress: wallet.address,
      provider: getInjectedProvider(),
      input,
      filingFeeWei: fee,
    });
    return outcome;
  }

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-white px-6 py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Review - exactly what will be recorded
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-muted">Category</dt>
            <dd className="text-ink">{categoryLabel(effectiveCategory)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-muted">Respondent</dt>
            <dd className="break-all font-mono text-xs text-ink">{input.respondentAddress}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-muted">Title</dt>
            <dd className="text-ink">{input.title}</dd>
          </div>
          {input.disputeContext !== "" ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-muted">Context</dt>
              <dd className="text-ink">{input.disputeContext}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-muted">Your statement</dt>
            <dd className="whitespace-pre-wrap text-ink">{input.claimantStatement}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-muted">Evidence</dt>
            <dd className="text-ink">{evidenceLine}</dd>
          </div>
          {input.precedentDisputeIds.length > 0 ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-muted">Precedents</dt>
              <dd className="font-mono text-xs text-ink">
                {input.precedentDisputeIds.join(", ")}
              </dd>
            </div>
          ) : null}
          {input.externalPrecedentUrls.length > 0 ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-muted">External sources</dt>
              <dd className="break-all font-mono text-xs text-ink">
                {input.externalPrecedentUrls.join(", ")}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-muted">Skip requests</dt>
            <dd className="text-ink">
              {input.requestedSkipParticipation === false &&
              input.requestedSkipAppeal === false
                ? "None - full participation window and full appeal rights requested."
                : [
                    input.requestedSkipParticipation === true ? "participation window" : null,
                    input.requestedSkipAppeal === true ? "appeals" : null,
                  ]
                    .filter((entry) => entry !== null)
                    .join(" and ") + " (takes effect only with the respondent's consent)"}
            </dd>
          </div>
        </dl>

        <PreflightChecks input={input} />

        <div className="mt-5 rounded-xl bg-attest-tint px-4 py-3 text-sm text-attest-deep">
          {filingFeeWei === null ? (
            "Checking the current filing fee\u2026"
          ) : filingFeeWei === 0n ? (
            "No filing fee is currently configured - filing is free."
          ) : (
            <>
              Filing fee: exactly {formatGenAmount(filingFeeWei)} will be
              attached to the transaction ({filingFeeWei.toString()} wei). The
              fee is never refunded.
            </>
          )}
        </div>
        {feeUnavailable ? (
          <p className="mt-2 text-xs text-status-danger" role="alert">
            The filing fee could not be confirmed. Refresh the page and try again.
          </p>
        ) : null}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Public record acknowledgment: everything above becomes part of a
          public, on-chain record. MetaTrial does not independently verify the
          authenticity, accuracy, or completeness of submitted evidence.
        </p>
      </div>

      <TransactionFlow
        triggerLabel="Sign & file this case"
        run={run}
        disabled={filingFeeWei === null}
        disabledReason="Waiting for the current filing fee."
        processingTitle="Filing the case"
        processingNote="Your transaction is going through consensus. The case appears on the public record as soon as it is decided."
        successTitle="Case filed - it is now on the public record."
        successNote="Opening your case\u2026"
        secondaryLabel="Review again"
        onSucceeded={() => {
          if (wallet.address !== null) {
            void getLastDisputeId(wallet.address).then((disputeId) => {
              if (disputeId !== "") {
                onFiled(disputeId);
              }
            });
          }
        }}
      />

      <div>
        <Button variant="secondary" onClick={onBack}>
          Back to options
        </Button>
      </div>
    </div>
  );
}


/**
 * Pre-flight checks that mirror every contract-rejectable condition the
 * client can know before signing: protocol pause state and precedent
 * citation validity (each cited case must exist and be finalized).
 * Bounded reads only; the contract remains authoritative at execution.
 */
function PreflightChecks({ input }: { input: SubmitDisputeInput }) {
  const healthQuery = useQuery({
    queryKey: ["metatrial", "protocol-health"],
    queryFn: getProtocolHealth,
    staleTime: 15_000,
  });
  const paused = healthQuery.data?.paused === true;

  const precedentChecks = useQueries({
    queries: input.precedentDisputeIds.map((disputeId) => ({
      queryKey: ["metatrial", "precedent-check", disputeId],
      queryFn: async () => {
        // dispute_exists returns false without reverting - avoids the
        // SDK's console.error for reverting reads on browsing paths.
        const exists = (await disputeExists(disputeId)) === true;
        if (exists === false) {
          return { disputeId, status: "", exists: false };
        }
        const status = await getDisputeStatus(disputeId);
        return { disputeId, status, exists: true };
      },
      staleTime: 30_000,
      retry: false,
    })),
  });

  const invalidPrecedents = precedentChecks
    .map((entry: { data?: { disputeId: string; status: string; exists: boolean } | undefined }, index: number) => {
      const data = entry.data;
      if (data === undefined) {
        return null;
      }
      if (data.exists === false || data.status !== "FINALIZED") {
        return input.precedentDisputeIds[index] ?? data.disputeId;
      }
      return null;
    })
    .filter((entry: string | null) => entry !== null);

  if (paused === false && invalidPrecedents.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-2">
      {paused === true ? (
        <p className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger" role="alert">
          New case filing is currently paused by protocol governance. The
          transaction would be rejected - please try again after the pause is
          lifted.
        </p>
      ) : null}
      {invalidPrecedents.length > 0 ? (
        <p className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger" role="alert">
          Precedent cases must exist and be finalized before they can be
          cited. Not yet citable:{""}
          <span className="font-mono text-xs">
            {invalidPrecedents.join(", ")}
          </span>
        </p>
      ) : null}
    </div>
  );
}
