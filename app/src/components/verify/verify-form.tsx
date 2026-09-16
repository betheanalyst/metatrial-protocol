"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Search } from "lucide-react";
import { detectVerificationMode } from "@/lib/metatrial/verification";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-attest focus:outline-none";

export function VerifyEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const mode = trimmed === "" ? null : detectVerificationMode(trimmed);

  return (
    <Container className="py-14">
      <header className="max-w-article">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-attest">
          Verify
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
          Check any determination, publicly.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Enter a Case ID, an Attestation ID, or a platform external
          reference. Verification is public - no wallet is ever required.
        </p>
      </header>

      <form
        className="mt-10 max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed !== "") {
            router.push(`/verify/${encodeURIComponent(trimmed)}`);
          }
        }}
      >
        <label htmlFor="verify-input" className="sr-only">
          Case ID, Attestation ID, or external reference
        </label>
        <input
          id="verify-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          placeholder="MT-00000012-1a2b3c4d, MT-ATTEST-00000001-1a2b3c4d, or a platform reference"
          spellCheck={false}
          className={inputClass}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={trimmed === ""}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verify
          </Button>
          {mode !== null ? (
            <span className="text-xs text-muted">
              Detected: {mode === "case" ? "Case ID" : mode === "attestation" ? "Attestation ID" : "external reference"}
            </span>
          ) : null}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          The result answers three questions: is this record real, is the
          determination final, and is the attestation currently valid and
          indexed.
        </p>
      </form>
    </Container>
  );
}
