import { homedir } from "node:os";
import { join } from "node:path";

export const SESSION_TTL_MS = 60 * 60 * 1000;

export const SESSION_LENGTH_SECONDS = SESSION_TTL_MS / 1000;

export const APP_NAME = "Zuno";

export const DEFAULT_SESSION_PATH = join(homedir(), ".zuno", "session.json");

export const ETH_ACCOUNT = {
  curve: "CURVE_SECP256K1",
  pathFormat: "PATH_FORMAT_BIP32",
  path: "m/44'/60'/0'/0/0",
  addressFormat: "ADDRESS_FORMAT_ETHEREUM",
} as const;
