#!/usr/bin/env node
/**
 * MetaTrial - Phase 1B Live Compatibility Gate
 *
 * Verifies the adopted frontend foundation against the deployed MetaTrial
 * contracts on GenLayer Studio Devnet (chain 61997), using read-only,
 * harmless view calls only. No protocol mutations are performed and no
 * data is fabricated.
 *
 * Checks:
 *   1. genlayer-js initializes against Studio Devnet
 *   2. Chain ID 61997 detected (SDK chain definition + live eth_chainId)
 *   3. Harmless read from MetaTrial Core               (get_protocol_info)
 *   4. Harmless read from MetaTrial Governance          (get_governance_info)
 *   5. Harmless read from MetaTrial Attestation Registry (get_registry_info)
 *   6. Args-based Core read - the case-discovery path
 *      (get_disputes_by_category / get_category_dispute_count)
 *   7. Clean contract error surface (get_dispute on a nonexistent ID
 *      must surface ERR:DISPUTE_NOT_FOUND, not an opaque crash)
 *
 * Wallet/provider and account/network detection logic is covered by the
 * vitest suite (src/lib/wallet/injected.test.ts), which `npm run
 * compat-gate` runs before this script. Live injected-wallet connection
 * additionally requires a browser with an installed wallet (Rabby or
 * MetaMask); this headless environment has none, so that portion is
 * reported as covered by the tested module plus live chain detection.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const protocol = require("../src/lib/config/protocol.json");
const { version: genlayerVersion } = require("../node_modules/genlayer-js/package.json");

import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createPublicClient, http } from "viem";

const results = [];

function report(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`);
}

function printSummary() {
  const failed = results.filter((entry) => entry.passed === false).length;
  console.log("");
  console.log(
    `Compatibility gate: ${
      failed === 0
        ? "ALL CHECKS PASSED"
        : failed + " CHECK(S) FAILED"
    } (${results.length} total)`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

async function main() {
  console.log("MetaTrial Phase 1B - Live Compatibility Gate");
  console.log(
    `network: ${protocol.network.name} (chain ${protocol.network.chainId} / ${protocol.network.chainIdHex})`,
  );
  console.log(`rpc:     ${protocol.network.rpcUrl}`);
  console.log("");

  // -- Check 1: SDK initializes against Studio Devnet ----------------------
  // Same RPC override the app adapter uses (config-driven endpoint).
  const appChain = {
    ...studioDevnet,
    rpcUrls: { default: { http: [protocol.network.rpcUrl] } },
  };
  let client;
  try {
    client = createClient({ chain: appChain });
    report(
      "1. SDK init - genlayer-js createClient(studioDevnet)",
      true,
      `genlayer-js ${genlayerVersion}`,
    );
  } catch (error) {
    report("1. SDK init - genlayer-js createClient(studioDevnet)", false, String(error));
    printSummary();
    return;
  }

  // -- Check 2: chain id 61997 detected (SDK + live RPC) --------------------
  let liveChainId = null;
  try {
    const publicClient = createPublicClient({
      transport: http(protocol.network.rpcUrl),
    });
    liveChainId = await publicClient.getChainId();
  } catch {
    liveChainId = null;
  }
  report(
    "2. Chain ID 61997 detected",
    studioDevnet.id === protocol.network.chainId &&
      liveChainId === protocol.network.chainId,
    `SDK studioDevnet.id=${studioDevnet.id}, live eth_chainId=${
      liveChainId === null ? "unreachable" : liveChainId
    }`,
  );

  // -- Checks 3-5: harmless reads from each contract ------------------------
  async function readView(address, functionName, callArgs = []) {
    const result = await client.readContract({
      address,
      functionName,
      args: callArgs,
      jsonSafeReturn: true,
    });
    if (typeof result === "string") {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    return result;
  }

  // 3. Core
  try {
    const info = await readView(protocol.contracts.core, "get_protocol_info");
    const ok =
      typeof info === "object" &&
      info !== null &&
      Number(info.version) > 0 &&
      Array.isArray(info.valid_categories);
    report(
      "3. Core live read - get_protocol_info()",
      ok,
      ok
        ? `protocol v${info.version}, total_disputes=${info.total_disputes}, ` +
          `total_attestations=${info.total_attestations}, ` +
          `${info.valid_categories.length} categories`
        : `unexpected response: ${JSON.stringify(info).slice(0, 160)}`,
    );
  } catch (error) {
    report("3. Core live read - get_protocol_info()", false, String(error));
  }

  // 4. Governance
  try {
    const info = await readView(protocol.contracts.governance, "get_governance_info");
    const ok =
      typeof info === "object" &&
      info !== null &&
      typeof info.active_admin_count === "number";
    report(
      "4. Governance live read - get_governance_info()",
      ok,
      ok
        ? `admins=${info.active_admin_count}, bootstrap_complete=${info.bootstrap_complete}, ` +
          `paused=${info.paused}, proposals=${info.total_proposals}`
        : `unexpected response: ${JSON.stringify(info).slice(0, 160)}`,
    );
  } catch (error) {
    report("4. Governance live read - get_governance_info()", false, String(error));
  }

  // 5. Attestation Registry
  try {
    const info = await readView(
      protocol.contracts.attestationRegistry,
      "get_registry_info",
    );
    const ok =
      typeof info === "object" &&
      info !== null &&
      typeof info.core_configured === "boolean";
    const wiringMatches = info.core_address === protocol.contracts.core;
    report(
      "5. Attestation Registry live read - get_registry_info()",
      ok,
      ok
        ? `architecture=${info.architecture}, core_configured=${info.core_configured}, ` +
          `registry->core wiring matches config: ${wiringMatches}`
        : `unexpected response: ${JSON.stringify(info).slice(0, 160)}`,
    );
  } catch (error) {
    report(
      "5. Attestation Registry live read - get_registry_info()",
      false,
      String(error),
    );
  }

  // -- Check 6: args-based read - the case-discovery path -------------------
  try {
    const category = "PAYMENT";
    const ids = await readView(protocol.contracts.core, "get_disputes_by_category", [
      category,
      0,
      12,
    ]);
    const count = await readView(
      protocol.contracts.core,
      "get_category_dispute_count",
      [category],
    );
    const ok = Array.isArray(ids) && typeof count === "number";
    report(
      "6. Core args-based read - get_disputes_by_category(PAYMENT, 0, 12)",
      ok,
      ok
        ? `${ids.length} dispute id(s) returned, category count ${count}`
        : `unexpected response: ${JSON.stringify(ids).slice(0, 120)} / ${String(count)}`,
    );
  } catch (error) {
    report(
      "6. Core args-based read - get_disputes_by_category(PAYMENT, 0, 12)",
      false,
      String(error),
    );
  }

  // -- Check 7: nonexistent dispute read surfaces a clean contract error ----
  try {
    const missing = await readView(protocol.contracts.core, "get_dispute", [
      "MT-00000001-deadbeef",
    ]);
    report(
      "7. Error surface - get_dispute(nonexistent)",
      false,
      `expected a contract error, got: ${JSON.stringify(missing).slice(0, 120)}`,
    );
  } catch (error) {
    // Contract UserErrors surface as base64 in error.cause.data.receipt.result
    // (confirmed live) - decode the cause chain the same way the app adapter does.
    const decoded = (() => {
      let current = error;
      let depth = 0;
      while (current && depth < 6) {
        const record = current;
        const data = record.data;
        for (const value of [data?.receipt?.result, data?.message]) {
          if (typeof value === "string" && value.trim()) {
            try {
              const text = globalThis.atob(value);
              if (text.includes("ERR:")) {
                return text;
              }
            } catch {
              if (value.includes("ERR:")) {
                return value;
              }
            }
          }
        }
        current = record.cause;
        depth += 1;
      }
      return null;
    })();
    const clean = decoded !== null && decoded.includes("ERR:DISPUTE_NOT_FOUND");
    report(
      "7. Error surface - get_dispute(nonexistent)",
      clean,
      clean
        ? `contract error surfaced cleanly: ${decoded}`
        : `could not decode ERR:DISPUTE_NOT_FOUND from the error - raw: ${String(error).slice(0, 200)}`,
    );
  }

  // -- Check 8: filing-fee dependency (get_protocol_health) -----------------
  try {
    const health = await readView(protocol.contracts.core, "get_protocol_health");
    const feeRaw = health?.dispute_filing_fee;
    const bondRaw = health?.appeal_bond_amount;
    let feesOk = false;
    try {
      // Fees can reach 10^24 wei - they arrive as strings and must survive
      // BigInt conversion (precision-safe handling required for filing).
      BigInt(String(feeRaw));
      BigInt(String(bondRaw));
      feesOk =
        typeof health?.treasury_address === "string" &&
        typeof feeRaw !== "undefined" &&
        typeof bondRaw !== "undefined";
    } catch {
      feesOk = false;
    }
    report(
      "8. Filing-fee dependency - get_protocol_health()",
      feesOk,
      feesOk
        ? `treasury ${health.treasury_address === "" ? "not configured (filing free)" : "configured"}, ` +
          `filing fee ${String(feeRaw)} wei, bond ${String(bondRaw)} wei (BigInt-safe)`
        : `unexpected health shape: ${JSON.stringify(health).slice(0, 160)}`,
    );
  } catch (error) {
    report("8. Filing-fee dependency - get_protocol_health()", false, String(error));
  }

  // -- Check 9: verification tri-state (Registry finality status) -----------
  try {
    const finality = await readView(protocol.contracts.attestationRegistry, "get_finality_status", [
      "MT-00000001-deadbeef",
    ]);
    const ok =
      typeof finality === "object" &&
      finality !== null &&
      finality.status === "NOT_FINAL";
    report(
      "9. Verification tri-state - get_finality_status(nonexistent)",
      ok,
      ok
        ? "nonexistent case correctly resolves to NOT_FINAL (finality vs mirror distinction live)"
        : `unexpected response: ${JSON.stringify(finality).slice(0, 160)}`,
    );
  } catch (error) {
    report("9. Verification tri-state - get_finality_status(nonexistent)", false, String(error));
  }

  printSummary();
}

main().catch((error) => {
  console.error("Compatibility gate crashed:", error);
  process.exitCode = 1;
});
