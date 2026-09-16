import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { NETWORK } from "../config/protocol";

export type GenLayerReadClient = ReturnType<typeof createClient>;

let cachedClient: GenLayerReadClient | null = null;

/**
 * Read-only GenLayer client for Studio Devnet.
 *
 * No wallet or account is required: every MetaTrial public view can be
 * served through this client, keeping public browsing and verification
 * wallet-free by design. Write flows (not part of this foundation phase)
 * will build a separate account-bound client through the wallet module.
 */
export function getReadClient(): GenLayerReadClient {
  if (cachedClient === null) {
    if (studioDevnet.id !== NETWORK.chainId) {
      throw new Error(
        `genlayer-js studioDevnet chain id ${studioDevnet.id} does not match ` +
          `the configured MetaTrial chain id ${NETWORK.chainId}`,
      );
    }
    cachedClient = createClient({ chain: studioDevnet });
  }
  return cachedClient;
}
