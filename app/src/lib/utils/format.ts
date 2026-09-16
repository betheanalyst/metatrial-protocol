/**
 * UTC-only, deterministic date formatting (no date libraries, per the
 * foundation specification). Always explicit about UTC so server-rendered
 * and client-rendered output match exactly.
 */

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatDate(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return "—";
  }
  return dateFormatter.format(new Date(seconds * 1000));
}

export function formatDateTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return "—";
  }
  return `${dateTimeFormatter.format(new Date(seconds * 1000))} UTC`;
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

/**
 * Wei -> GEN display (18 decimals), truncated to 6 fractional digits and
 * trailing-zero-trimmed. The exact wei amount always stays available for
 * the title tooltip - display never pretends more precision than it has.
 */
export function formatGenAmount(wei: bigint): string {
  if (wei === 0n) {
    return "0 GEN";
  }
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = abs / 10n ** 18n;
  const fraction = abs % 10n ** 18n;
  let text: string;
  if (fraction === 0n) {
    text = whole.toString();
  } else {
    const fractionText = fraction
      .toString()
      .padStart(18, "0")
      .slice(0, 6)
      .replace(/0+$/, "");
    text = `${whole}.${fractionText}`;
  }
  return `${negative ? "-" : ""}${text} GEN`;
}
