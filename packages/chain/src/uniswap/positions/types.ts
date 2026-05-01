import type { Address, ChainId } from "@zuno/core";

export interface PositionReadOptions {
  chainId?: ChainId;
  owner?: Address;
  client?: ContractReader;
}

export interface ContractReader {
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}
