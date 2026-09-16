import { describe, expect, it, vi } from "vitest";
import {
  detectChainId,
  getAccounts,
  getInjectedProvider,
  isStudioDevnetChainId,
  requestAccounts,
  STUDIO_DEVNET_CHAIN_PARAMS,
  switchOrAddStudioDevnet,
  type Eip1193Provider,
} from "./injected";

const ACCOUNT = "0xabc0000000000000000000000000000000000abc";

function makeProvider(
  overrides: Partial<Eip1193Provider> = {},
  requestImpl?: Eip1193Provider["request"],
): Eip1193Provider {
  return {
    request: requestImpl ?? vi.fn().mockResolvedValue("0x1"),
    ...overrides,
  };
}

describe("getInjectedProvider", () => {
  it("returns null when no provider is injected", () => {
    expect(getInjectedProvider({})).toBeNull();
  });

  it("returns the single injected provider", () => {
    const provider = makeProvider({ isMetaMask: true });
    expect(getInjectedProvider({ ethereum: provider })).toBe(provider);
  });

  it("prefers Rabby among multiple providers", () => {
    const metaMask = makeProvider({ isMetaMask: true });
    const rabby = makeProvider({ isRabby: true, isMetaMask: true });
    const aggregator = makeProvider({ providers: [metaMask, rabby] });
    expect(getInjectedProvider({ ethereum: aggregator })).toBe(rabby);
  });

  it("falls back to MetaMask when Rabby is absent", () => {
    const other = makeProvider({});
    const metaMask = makeProvider({ isMetaMask: true });
    const aggregator = makeProvider({ providers: [other, metaMask] });
    expect(getInjectedProvider({ ethereum: aggregator })).toBe(metaMask);
  });
});

describe("network detection", () => {
  it("parses eth_chainId 0xf22d as Studio Devnet 61997", async () => {
    const provider = makeProvider({}, vi.fn().mockResolvedValue("0xf22d"));
    await expect(detectChainId(provider)).resolves.toBe(61997);
    expect(isStudioDevnetChainId(61997)).toBe(true);
  });

  it("detects when the wallet is on a different network", async () => {
    const provider = makeProvider({}, vi.fn().mockResolvedValue("0x1"));
    await expect(detectChainId(provider)).resolves.toBe(1);
    expect(isStudioDevnetChainId(1)).toBe(false);
  });

  it("rejects malformed eth_chainId responses", async () => {
    const provider = makeProvider({}, vi.fn().mockResolvedValue(61997));
    await expect(detectChainId(provider)).rejects.toThrow("eth_chainId");
  });
});

describe("account detection", () => {
  it("returns string accounts from eth_requestAccounts", async () => {
    const provider = makeProvider({}, vi.fn().mockResolvedValue([ACCOUNT]));
    await expect(requestAccounts(provider)).resolves.toEqual([ACCOUNT]);
  });

  it("returns already-authorized accounts without prompting", async () => {
    const provider = makeProvider({}, vi.fn().mockResolvedValue([]));
    await expect(getAccounts(provider)).resolves.toEqual([]);
  });
});

describe("switchOrAddStudioDevnet", () => {
  it("only switches when the wallet already knows the chain", async () => {
    const request = vi.fn().mockResolvedValue(null);
    await switchOrAddStudioDevnet(makeProvider({}, request));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_DEVNET_CHAIN_PARAMS.chainId }],
    });
  });

  it("adds the chain when switching rejects with 4902", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Unrecognized chain ID"), { code: 4902 }),
      )
      .mockResolvedValueOnce(null);
    await switchOrAddStudioDevnet(makeProvider({}, request));
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "wallet_addEthereumChain",
      params: [STUDIO_DEVNET_CHAIN_PARAMS],
    });
  });

  it("re-raises unrelated switch errors", async () => {
    const request = vi.fn().mockRejectedValue(new Error("user rejected"));
    await expect(
      switchOrAddStudioDevnet(makeProvider({}, request)),
    ).rejects.toThrow("user rejected");
  });
});
