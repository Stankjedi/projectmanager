#!/usr/bin/env bash
# 목적: 긴 출력에서 핵심 에러 라인 + 마지막 컨텍스트를 제공
# 사용법: bash .debug/scripts/llm-run.sh "npm run build"

set -o pipefail

CMD="$1"
if [ -z "$CMD" ]; then
  echo "Usage: bash .debug/scripts/llm-run.sh \"<command>\""
  exit 2
fi

mkdir -p .debug/logs
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG=".debug/logs/${STAMP}.log"

echo "== RUN =="
echo "$CMD"

bash -lc "$CMD" 2>&1 | tee "$LOG"

echo
echo "== LOG SAVED =="
echo "$LOG"

echo
echo "== ERROR HIGHLIGHTS =="
grep -E -i "error|failed|exception|traceback|fatal|undefined|cannot|not found|ts[0-9]{3,}|e[0-9]{3,}" "$LOG" | head -n 120 || true

echo
echo "== TAIL 200 =="
tail -n 200 "$LOG"
