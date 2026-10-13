#!/usr/bin/env bash
# Runs a k6 script against a throwaway local stack:
#   DynamoDB Local + Redis (docker compose) · the built API · a local stand-in for the gateway.
#
#   ./load-tests/run.sh browse            # read traffic, cache on
#   CACHE=off ./load-tests/run.sh browse  # same traffic without Redis
#   ./load-tests/run.sh checkout          # purchases through the gateway stand-in
#
# Results: load-tests/results/<script>-cache-<on|off>.json (git-ignored) and the k6 summary.
set -euo pipefail

SCRIPT="${1:?usage: run.sh <browse|checkout>}"
CACHE="${CACHE:-on}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${API_PORT:-3100}"
STUB_PORT="${STUB_PORT:-4010}"
PIDS=()
cd "$ROOT"
mkdir -p load-tests/results

export AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local
export DYNAMODB_ENDPOINT=http://localhost:8000
export TABLE_PRODUCTS=load-products TABLE_CUSTOMERS=load-customers
export TABLE_TRANSACTIONS=load-transactions TABLE_DELIVERIES=load-deliveries

stop_processes() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap stop_processes EXIT

docker compose up -d dynamodb redis >/dev/null
npm run build -w apps/api >/dev/null
(cd apps/api && node dist/seed/create-tables.js && node dist/seed/seed.js) >/dev/null
node load-tests/prepare-data.mjs
docker compose exec -T redis redis-cli FLUSHALL >/dev/null

PORT="$STUB_PORT" GATEWAY_STUB_DELAY_MS="${GATEWAY_DELAY_MS:-150}" \
  npm run --silent gateway:stub -w apps/api &
PIDS+=("$!")

if [ "$CACHE" = on ]; then
  export REDIS_URL=redis://localhost:6379
fi

# Started from the repository root on purpose: there is no .env here, so nothing local leaks in.
NODE_ENV=production LOG_LEVEL=error PORT="$API_PORT" TRUST_PROXY=true \
  RATE_LIMIT_PER_MINUTE=100000 \
  PAYMENT_GATEWAY_BASE_URL="http://127.0.0.1:$STUB_PORT/v1" \
  PAYMENT_GATEWAY_PUBLIC_KEY=pub_test_load PAYMENT_GATEWAY_PRIVATE_KEY=prv_test_load \
  PAYMENT_GATEWAY_INTEGRITY_SECRET=test_integrity_load \
  node apps/api/dist/main.js &
PIDS+=("$!")

for _ in $(seq 1 40); do
  curl -fs "http://localhost:$API_PORT/api/v1/health" >/dev/null 2>&1 && break
  sleep 0.5
done

docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$ROOT/load-tests:/scripts" -w /scripts \
  -e BASE_URL="http://localhost:$API_PORT" \
  -e RESULT_FILE="results/$SCRIPT-cache-$CACHE.json" \
  -e STEADY_RPS -e PEAK_RPS -e STEADY_DURATION -e SPIKE_DURATION \
  -e CHECKOUT_RPS -e CHECKOUT_PEAK_RPS \
  grafana/k6:latest run "$SCRIPT.js"
