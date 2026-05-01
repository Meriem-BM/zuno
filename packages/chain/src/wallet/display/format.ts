import type { ChainId } from "@zuno/core";

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function chainNameFor(id: ChainId | number): string {
  switch (id) {
    case 1:
      return "Mainnet";
    case 10:
      return "Optimism";
    case 8453:
      return "Base";
    case 42161:
      return "Arbitrum";
    default:
      return `Chain ${id}`;
  }
}
