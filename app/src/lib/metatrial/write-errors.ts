import { extractContractMessage, extractRawErrorText } from "@/lib/genlayer/errors";

/**
 * Contract ERR codes -> human language with consequence and recovery
 * (Visual Handoff error-language rules). Raw codes remain available for
 * progressive disclosure, never as the primary message.
 */

const MESSAGES: Record<string, string> = {
  "ERR:PROTOCOL_PAUSED":
    "New case filing is paused by protocol governance right now. Existing cases continue normally - please try again later.",
  "ERR:INCORRECT_FEE":
    "The filing fee changed while this case was being prepared. Filing requires the exact configured amount - review the fee shown and submit again.",
  "ERR:INCORRECT_BOND":
    "The appeal bond amount changed. Filing an appeal requires the exact configured bond - review and submit again.",
  "ERR:RESPONDENT_ADDRESS_INVALID":
    "The respondent address is missing or invalid. Enter the respondent's wallet address.",
  "ERR:RESPONDENT_ADDRESS_MALFORMED":
    "That respondent address is not a valid blockchain address. Check it and try again.",
  "ERR:SELF_DISPUTE":
    "A case cannot be filed against your own address.",
  "ERR:RESPONDENT_RATE_LIMIT":
    "Too many cases have been filed against this respondent within 24 hours. Please try again later.",
  "ERR:CLAIMANT_RATE_LIMIT":
    "You have filed the maximum number of cases allowed within 24 hours. Please try again later.",
  "ERR:TITLE_INVALID":
    "The case title must be between 1 and 200 characters.",
  "ERR:INVALID_CATEGORY":
    "That category is not available. Choose one of the listed categories.",
  "ERR:CONTEXT_TOO_LONG":
    "The neutral context is limited to 500 characters.",
  "ERR:EXTERNAL_REF_TOO_LONG":
    "The external reference is limited to 128 characters.",
  "ERR:CLAIMANT_STATEMENT_INVALID":
    "Your statement is required and must be at most 3,000 characters.",
  "ERR:STATEMENT_TOO_LONG":
    "The statement is limited to 3,000 characters.",
  "ERR:EV_URL_NOT_IMMUTABLE:CLAIMANT":
    "URL evidence must use content-addressed storage (IPFS or Arweave) so it cannot be silently changed.",
  "ERR:EV_URL_NOT_IMMUTABLE:RESPONDENT":
    "URL evidence must use content-addressed storage (IPFS or Arweave) so it cannot be silently changed.",
  "ERR:EV_HASH_REQUIRED:CLAIMANT":
    "URL and file evidence need their content hash (CID or Arweave transaction ID).",
  "ERR:EV_HASH_REQUIRED:RESPONDENT":
    "URL and file evidence need their content hash (CID or Arweave transaction ID).",
  "ERR:EV_SUMMARY_REQUIRED:CLAIMANT":
    "File-reference evidence needs a summary of at least 50 characters.",
  "ERR:EV_SUMMARY_REQUIRED:RESPONDENT":
    "File-reference evidence needs a summary of at least 50 characters.",
  "ERR:EV_TYPE_WITHOUT_CONTENT:RESPONDENT":
    "An evidence type was selected without any evidence content. Add the content or clear the evidence.",
  "ERR:DISPUTE_NOT_FOUND":
    "That case does not exist on the protocol.",
  "ERR:NOT_RESPONDENT":
    "Only the designated respondent can respond to this case.",
  "ERR:PARTICIPATION_CLOSED":
    "Participation has closed for this case - the review has already begun or finished.",
  "ERR:PARTICIPATION_WINDOW_EXPIRED":
    "The participation window has closed, so a response can no longer be added.",
  "ERR:PARTICIPATION_WINDOW_OPEN":
    "The participation window is still open. Review can start once it expires - or as soon as the respondent submits their side.",
  "ERR:NOT_CLAIMANT":
    "Only the claimant can start the review.",
  "ERR:WRONG_STATUS":
    "This case has moved on and no longer accepts that action.",
};

const FALLBACK =
  "The protocol did not accept this transaction. Nothing was changed - review the details and try again.";

/**
 * Translate any write/read failure into human language. Returns the
 * primary message plus the raw contract code for progressive disclosure.
 */
export function describeWriteFailure(error: unknown): {
  primary: string;
  raw: string | null;
} {
  const contractMessage = extractContractMessage(error);
  if (contractMessage === null) {
    const text = error instanceof Error ? error.message : String(error);
    if (text.includes("User rejected") || text.includes("user rejected")) {
      return {
        primary:
          "The transaction was not signed - nothing was submitted. You can try again.",
        raw: null,
      };
    }
    return {
      primary: FALLBACK,
      raw: extractRawErrorText(error) ?? text.slice(0, 200),
    };
  }
  const codeMatch = contractMessage.match(/ERR:[A-Z_]+/);
  const code = codeMatch === null ? null : codeMatch[0];
  const mapped =
    code !== null && MESSAGES[code] !== undefined ? MESSAGES[code] : null;
  const primary =
    mapped ??
    (contractMessage.includes("ERR:")
      ? "The protocol rejected this transaction."
      : FALLBACK);
  return { primary, raw: code ?? contractMessage.slice(0, 120) };
}
