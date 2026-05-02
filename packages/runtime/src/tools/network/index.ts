import {
  chainConfig,
  defaultChainId,
  resolveNetwork,
  SUPPORTED_NETWORKS,
} from "@zuno/chain/config";
import type { ShowNetworkData, SwitchNetworkData, ToolDefinition } from "../../contracts/types.js";
import { err, ok } from "../shared.js";

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
      supported: SUPPORTED_NETWORKS.map((c) => ({ chainId: c.chainId, name: c.name })),
    };
    return ok("showNetwork", `On ${chain.name} (chain ${chainId}).`, data);
  },
};

const switchNetwork: ToolDefinition = {
  name: "switchNetwork",
  intents: ["switch_network"],
  execute: (intent, ctx) => {
    const target = resolveNetwork(intent.chainName ?? intent.rawInput);
    if (!target) {
      return err(
        "switchNetwork",
        "CHAIN_UNSUPPORTED",
        `Supported networks: ${SUPPORTED_NETWORKS.map((network) => network.name.toLowerCase()).join(", ")}.`,
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

export const NETWORK_TOOLS: readonly ToolDefinition[] = [showNetwork, switchNetwork];
