import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { NETWORK } from "../config/protocol";

export type GenLayerReadClient = ReturnType<typeof createClient>;

/**
 * Read-only GenLayer clients for Studio Devnet - one per configured RPC.
 *
 * No wallet or account is required: every MetaTrial public view can be
 * served through this client, keeping public browsing and verification
 * wallet-free by design. Write flows (not part of this foundation phase)
 * will build a separate account-bound client through the wallet module.
 *
 * The primary RPC is listed first; the alternative RPC (same deployment,
 * configured in protocol.json) is the failover target. The Studio endpoints
 * occasionally drop individual requests ("fetch failed"), so the read
 * adapter retries and fails over across this pool instead of surfacing the
 * blip to the UI as an empty or unavailable page.
 */
const rpcUrls: readonly string[] = NETWORK.alternativeRpcUrl
  ? [NETWORK.rpcUrl, NETWORK.alternativeRpcUrl]
  : [NETWORK.rpcUrl];

const clients = new Map<string, GenLayerReadClient>();

function buildClient(rpcUrl: string): GenLayerReadClient {
  if (studioDevnet.id !== NETWORK.chainId) {
    throw new Error(
      `genlayer-js studioDevnet chain id ${studioDevnet.id} does not match ` +
        `the configured MetaTrial chain id ${NETWORK.chainId}`,
    );
  }
  // The SDK chain preset carries its own RPC - override it with the
  // configured MetaTrial RPC so client, wallet, and gate all talk to the
  // same deployment (centralized configuration rule).
  const chain = {
    ...studioDevnet,
    rpcUrls: { default: { http: [rpcUrl] } },
  } as typeof studioDevnet;
  return createClient({ chain });
}

/** Clients in failover order: primary RPC first, alternative second. */
export function getReadClients(): GenLayerReadClient[] {
  return rpcUrls.map((rpcUrl) => {
    let client = clients.get(rpcUrl);
    if (client === undefined) {
      client = buildClient(rpcUrl);
      clients.set(rpcUrl, client);
    }
    return client;
  });
}

/**
 * Backwards-compatible primary read client (single consumer: the read
 * adapter in reads.ts, which owns retry and failover).
 */
export function getReadClient(): GenLayerReadClient {
  return getReadClients()[0];
}
