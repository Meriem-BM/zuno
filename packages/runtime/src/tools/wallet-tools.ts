import type { Address, ChainId } from "@zuno/core";
import type { ToolDefinition } from "../types.js";
import { err, ok } from "./shared.js";

const MOCK_WALLET: Address = "0xabc1230000000000000000000000000000000def";
const MOCK_CHAIN: ChainId = 1;

const connectWallet: ToolDefinition = {
  name: "connectWallet",
  intents: ["connect_wallet"],
  execute: () =>
    ok("connectWallet", `Connected wallet ${MOCK_WALLET.slice(0, 6)}…`, {
      walletAddress: MOCK_WALLET,
      chainId: MOCK_CHAIN,
      signerMode: "wallet",
    }),
};

const showWalletBalance: ToolDefinition = {
  name: "showWalletBalance",
  intents: ["show_balance"],
  execute: (_, { session }) => {
    if (!session.walletAddress) {
      return err("showWalletBalance", "WALLET_NOT_CONNECTED", "Connect a wallet first.");
    }
    return ok("showWalletBalance", "Wallet balance loaded.", {
      walletAddress: session.walletAddress,
      balances: [
        { token: "ETH", amount: "1.234" },
        { token: "USDC", amount: "5000.00" },
      ],
    });
  },
};

const listWalletPositions: ToolDefinition = {
  name: "listWalletPositions",
  intents: ["list_positions"],
  execute: () =>
    ok("listWalletPositions", "Loaded 2 positions.", {
      positions: [
        { positionId: "42", pair: "ETH/USDC", feeTier: 500 },
        { positionId: "77", pair: "WBTC/USDC", feeTier: 3000 },
      ],
    }),
};

export const WALLET_TOOLS: readonly ToolDefinition[] = [
  connectWallet,
  showWalletBalance,
  listWalletPositions,
];
