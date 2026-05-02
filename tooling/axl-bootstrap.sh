#!/usr/bin/env bash
# Bootstrap 5 local AXL nodes (cli + four agent roles).
#
# For each of cli, scout, strategist, critic, arbiter this writes:
#   tooling/axl/<role>.pem           ed25519 private key
#   tooling/axl/<role>-config.json   AXL node config (api_port + tcp_port)
#
# Then prints the .env block with the five ZUNO_AXL_<ROLE>_PEER_ID values
# so you can paste it straight into .env.
#
# Run a real Gensyn AXL node binary against each config in its own terminal:
#   ./node -config tooling/axl/cli-config.json
#   ./node -config tooling/axl/scout-config.json
#   ./node -config tooling/axl/strategist-config.json
#   ./node -config tooling/axl/critic-config.json
#   ./node -config tooling/axl/arbiter-config.json
#
# Requires Homebrew OpenSSL on macOS (LibreSSL ships without ed25519).

set -euo pipefail

OPENSSL="${OPENSSL:-openssl}"
if ! "$OPENSSL" genpkey -algorithm ed25519 -out /dev/null 2>/dev/null; then
  if [[ -x /opt/homebrew/opt/openssl/bin/openssl ]]; then
    OPENSSL=/opt/homebrew/opt/openssl/bin/openssl
  else
    echo "ed25519 not supported by $OPENSSL. Install Homebrew openssl: brew install openssl" >&2
    exit 1
  fi
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/tooling/axl"
mkdir -p "$OUT"

env_block=()
for entry in "cli 9002 7001" "scout 9012 7011" "strategist 9022 7021" "critic 9032 7031" "arbiter 9042 7041"; do
  set -- $entry
  role=$1
  api_port=$2
  tcp_port=$3
  pem="$OUT/$role.pem"
  cfg="$OUT/$role-config.json"

  if [[ ! -f "$pem" ]]; then
    "$OPENSSL" genpkey -algorithm ed25519 -out "$pem"
  fi

  pubhex=$("$OPENSSL" pkey -in "$pem" -pubout -outform DER \
    | tail -c 32 | xxd -p -c 64)

  cat >"$cfg" <<JSON
{
  "PrivateKeyPath": "$pem",
  "Peers": [],
  "Listen": [],
  "api_port": $api_port,
  "tcp_port": $tcp_port
}
JSON

  upper=$(printf '%s' "$role" | tr '[:lower:]' '[:upper:]')
  env_block+=("ZUNO_AXL_${upper}_PEER_ID=$pubhex")
done

echo
echo "# Paste into .env"
for line in "${env_block[@]}"; do
  echo "$line"
done
echo
echo "# Default api urls (override per role if you change ports):"
echo "ZUNO_AXL_CLI_API_URL=http://127.0.0.1:9002"
echo "ZUNO_AXL_SCOUT_API_URL=http://127.0.0.1:9012"
echo "ZUNO_AXL_STRATEGIST_API_URL=http://127.0.0.1:9022"
echo "ZUNO_AXL_CRITIC_API_URL=http://127.0.0.1:9032"
echo "ZUNO_AXL_ARBITER_API_URL=http://127.0.0.1:9042"
