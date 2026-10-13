#!/bin/sh
# ShopperStop guardrails, run as PreToolUse hooks. Usage: guard.sh <rule>; stdin is the hook JSON.
#   docker  every session: never run docker compose or touch containers (CLAUDE.md)
#   lane    lane sub-agents only: never push, pull, merge or open a PR
#   plan    lane sub-agents only: never edit PLAN.md or an area plan
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}
case "$1" in
  docker)
    printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])docker(-compose|[[:space:]]+(compose|start|stop|rm|kill|restart|run|up|down|exec))' \
      && deny "Agents never run docker compose or touch containers. Postgres is shopperstop-postgres-1, started by the orchestrator with make db. Report the need instead." ;;
  lane)
    printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])(git[[:space:]]+(push|pull|merge|fetch)|gh[[:space:]]+pr)([;&|[:space:]]|$)' \
      && deny "Lanes commit on their branch and never push, pull, merge or open a PR. The area manager lands the PR after verifying. Finish and report instead." ;;
  plan)
    printf '%s' "$file" | grep -Eq '(^|/)(PLAN\.md|\.claude/areas/[^/]+\.md)$' \
      && deny "Only the orchestrator edits PLAN.md and only the area manager edits the area plan. Put the decision or status in your report." ;;
esac
exit 0
