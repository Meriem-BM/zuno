import { chainConfig, defaultChainId } from "@zuno/chain/config";
import type { ChainId } from "@zuno/core";
import type { ShowNetworkData, SwitchNetworkData, ToolDefinition } from "../../contracts/types.js";
import { err, ok } from "../shared.js";

const SUPPORTED: { chainId: ChainId; name: string; aliases: string[] }[] = [
  { chainId: 1, name: "Mainnet", aliases: ["mainnet", "ethereum", "eth"] },
  { chainId: 10, name: "Optimism", aliases: ["optimism", "op"] },
  { chainId: 8453, name: "Base", aliases: ["base"] },
  { chainId: 42161, name: "Arbitrum", aliases: ["arbitrum", "arb"] },
];

const showNetwork: ToolDefinition = {
  name: "showNetwork",
  intents: ["show_network"],
  execute: (_, ctx) => {
    const chainId = ctx.session.chainId ?? defaultChainId();
    const chain = chainConfig(chainId);
    const data: ShowNetworkData = {
      chainId,
      chainName: chain.name,
      nativeSymbol: chain.nativeSymbol,
      rpcConfigured: Boolean(chain.rpcUrl),
      supported: SUPPORTED.map((c) => ({ chainId: c.chainId, name: c.name })),
    };
    return ok("showNetwork", `On ${chain.name} (chain ${chainId}).`, data);
  },
};

const switchNetwork: ToolDefinition = {
  name: "switchNetwork",
  intents: ["switch_network"],
  execute: (intent, ctx) => {
    const target = resolveTarget(intent.chainName ?? intent.rawInput);
    if (!target) {
      return err(
        "switchNetwork",
        "CHAIN_UNSUPPORTED",
        "Supported networks: mainnet, optimism, base, arbitrum.",
      );
    }
    const previousChainId = ctx.session.chainId ?? defaultChainId();
    if (previousChainId === target.chainId) {
      return ok("switchNetwork", `Already on ${target.name}.`, {
        previousChainId,
        chainId: target.chainId,
        chainName: target.name,
      } satisfies SwitchNetworkData);
    }
    const data: SwitchNetworkData = {
      previousChainId,
      chainId: target.chainId,
      chainName: target.name,
    };
    return {
      tool: "switchNetwork",
      status: "success",
      message: `Switched to ${target.name}.`,
      data,
    };
  },
};

function resolveTarget(input: string): { chainId: ChainId; name: string } | null {
  const lower = input.toLowerCase();
  for (const chain of SUPPORTED) {
    if (chain.aliases.some((alias) => lower.includes(alias))) return chain;
  }
  return null;
}

export const NETWORK_TOOLS: readonly ToolDefinition[] = [showNetwork, switchNetwork];
