#!/bin/sh
# Checks the platform-payment-wiring scenarios that have no other test: deploy files, Makefile, CI, docs.
# Run from the repository root: sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh [deploy] [make] [ci] [docs]
# (no argument runs every section). Starts nothing: a real make run only for payment targets while services/payment
# is absent (they print a skip line), make -n otherwise, plus a scratch copy of the Makefile with every directory present.
# Prints one FAIL line per gap; the last line is "payment wiring check: ok" or "payment wiring check: N failures".
f=0
fail() { echo "FAIL: $*"; f=$((f+1)); }
has() { printf '%s\n' "$2" | grep -qF -- "$3" || fail "$1 lacks: $3"; }
lacks() { printf '%s\n' "$2" | grep -qF -- "$3" && fail "$1 still has: $3"; }
# in_order <label> <text> <pattern>...: each pattern occurs, each first occurrence after the previous one.
in_order() {
  label=$1 text=$2 prev=-1; shift 2
  for p in "$@"; do
    n=$(printf '%s' "$text" | grep -boF -- "$p" | head -1 | cut -d: -f1)
    if [ -z "$n" ] || [ "$n" -le "$prev" ]; then fail "$label: '$p' missing or out of order"; return; fi
    prev=$n
  done
}
# value <text> <VAR>: the single-quoted value the first "VAR='...'" in text carries.
value() { printf '%s' "$1" | sed -n "s/.*$2='\([^']*\)'.*/\1/p" | head -1; }
count() { grep -oF -- "$1" Makefile | wc -l | tr -d ' '; }
root=$(pwd)
sections=${*:-deploy make ci docs}

for s in $sections; do case $s in
deploy)
  want="create role shopperstop_core login password 'shopperstop_core';
create database shopperstop_core owner shopperstop_core;
create database shopperstop_core_test owner shopperstop_core;
create database shopperstop_core_e2e owner shopperstop_core;
create role shopperstop_rider login password 'shopperstop_rider';
create database shopperstop_rider owner shopperstop_rider;
create database shopperstop_rider_test owner shopperstop_rider;
create database shopperstop_rider_e2e owner shopperstop_rider;
create role shopperstop_payment login password 'shopperstop_payment';
create database shopperstop_payment owner shopperstop_payment;
create database shopperstop_payment_test owner shopperstop_payment;
create database shopperstop_payment_e2e owner shopperstop_payment;"
  [ "$(cat deploy/initdb.sql)" = "$want" ] || fail "deploy/initdb.sql is not the twelve statements"
  c=$(cat deploy/Caddyfile)
  in_order Caddyfile "$c" 'handle /api/core/* {' 'reverse_proxy host.docker.internal:8080' 'handle /api/rider/* {' \
    'reverse_proxy host.docker.internal:8081' 'handle /api/payment/* {' 'reverse_proxy host.docker.internal:8082' 'handle /admin/* {'
  for p in 'root * /srv/apps/admin/dist' 'root * /srv/apps/rider/dist' 'root * /srv/apps/web/dist'; do has Caddyfile "$c" "$p"; done
  [ "$(grep -c 'try_files {path} /index.html' deploy/Caddyfile)" = 3 ] || fail "Caddyfile: want try_files in three blocks"
  lacks Caddyfile "$c" 'handle /payment/*'
  ;;
make)
  # This tree: real runs only while services/payment is absent, so nothing is ever started.
  if [ -d services/payment ]; then
    echo "note: services/payment present, real skip runs not checked"
  else
    for t in payment test-payment; do
      out=$(make "$t" 2>&1); st=$?
      [ "$st" = 0 ] && [ "$out" = "$t: services/payment absent, skipping" ] || fail "make $t: exit $st, output: $out"
    done
    for t in seed e2e prod-local; do
      has "make -n $t" "$(make -n $t 2>&1)" "else echo \"$t: services/payment absent, skipping\"; fi"
    done
    has "make -n gen" "$(make -n gen 2>&1)" 'else echo "gen: services/payment/sqlc.yaml absent, skipping"; fi'
  fi
  [ "$(count localhost:5176)" = 3 ] || fail "Makefile names localhost:5176 $(count localhost:5176) times, want 3"
  [ "$(count localhost:15176)" = 3 ] || fail "Makefile names localhost:15176 $(count localhost:15176) times, want 3"

  # Every part present: a scratch copy of the Makefile, never this tree.
  tmp=$(mktemp -d)
  cp Makefile "$tmp/"
  (
    f=0
    cd "$tmp" || exit 1
    mkdir -p services/core services/rider services/payment apps/web apps/admin apps/rider packages/ui
    touch services/core/sqlc.yaml services/rider/sqlc.yaml services/payment/sqlc.yaml
    echo '{"name":"scratch","private":true,"workspaces":["packages/*","apps/*"]}' > package.json
    unset SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN SHOPPERSTOP_CORE_SERVICE_TOKENS
    in_order "make -n dev" "$(make -n dev 2>&1)" 'up -d --wait postgres' 'go run ./cmd/core-admin migrate' 'go run ./cmd/rider-admin migrate' \
      'go run ./cmd/payment-admin migrate' 'go run ./cmd/payment-admin seed-demo --reset' '-j6 core rider payment web admin rider-app' \
      'go run ./cmd/core;' 'go run ./cmd/rider;' 'go run ./cmd/payment;' 'npm run dev --workspace apps/web'
    core=$(make -n core) rider=$(make -n rider) payment=$(make -n payment)
    rtok=$(value "$rider" SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN) ptok=$(value "$payment" SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN)
    [ "${#ptok}" -ge 32 ] && [ "$ptok" != "$rtok" ] || fail "make -n payment: service token shorter than 32 bytes or equal to the rider's"
    has "make -n core" "$core" "SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:$rtok,payment:$ptok'"
    for p in "SHOPPERSTOP_PAYMENT_DATABASE_URL='postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment?sslmode=disable'" \
      "SHOPPERSTOP_PAYMENT_ADDR=':8082'" "SHOPPERSTOP_PAYMENT_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'" \
      "SHOPPERSTOP_PAYMENT_CORE_URL='http://localhost:8080'" "SHOPPERSTOP_PAYMENT_GATEWAY='fake'" \
      "SHOPPERSTOP_PAYMENT_PUBLIC_URL='http://localhost:8082'" 'cd services/payment' 'go run ./cmd/payment;'; do has "make -n payment" "$payment" "$p"; done
    pep=$(value "$payment" SHOPPERSTOP_PAYMENT_SESSION_PEPPER)
    [ "${#pep}" -ge 32 ] || fail "make -n payment: pepper shorter than 32 bytes"
    has "make -n payment override" "$(make -n payment SHOPPERSTOP_PAYMENT_ADDR=:9092)" "SHOPPERSTOP_PAYMENT_ADDR=':9092'"
    in_order "make -n test" "$(make -n test 2>&1)" 'cd services/core && test -z' 'cd services/rider && test -z' 'cd services/payment && test -z' \
      "SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL='postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment_test?sslmode=disable' go test -race ./..." 'npm run lint'
    out=$(SHOPPERSTOP_PAYMENT_DATABASE_URL=leak SHOPPERSTOP_PAYMENT_GATEWAY=leak SHOPPERSTOP_PAYMENT_PUBLIC_URL=leak SHOPPERSTOP_CORE_SERVICE_TOKENS=leak make -n e2e 2>&1)
    lacks "make -n e2e" "$out" leak
    in_order "make -n e2e" "$out" 'go run ./cmd/core-admin migrate' 'go run ./cmd/rider-admin migrate' 'go run ./cmd/payment-admin migrate' \
      'go run ./cmd/payment-admin seed-demo --reset' 'npm run build --workspaces --if-present' 'npm run e2e --workspaces --if-present'
    e2e=$(printf '%s\n' "$out" | grep -F 'npm run e2e')
    for p in "shopperstop_payment_e2e" "SHOPPERSTOP_PAYMENT_ADDR=':18082'" "SHOPPERSTOP_PAYMENT_CORE_URL='http://localhost:18080'" \
      "SHOPPERSTOP_PAYMENT_GATEWAY='fake'" "SHOPPERSTOP_PAYMENT_PUBLIC_URL='http://localhost:18082'" \
      "SHOPPERSTOP_PAYMENT_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'"; do
      has "make -n e2e npm run e2e" "$e2e" "$p"; done
    ertok=$(value "$e2e" SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN) eptok=$(value "$e2e" SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN)
    [ "${#eptok}" -ge 32 ] && [ "$eptok" != "$ptok" ] && [ "$eptok" != "$ertok" ] || fail "make -n e2e: payment token short, equal to the dev token or to the rider's"
    has "make -n e2e npm run e2e" "$e2e" "SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:$ertok,payment:$eptok'"
    in_order "make -n gen" "$(make -n gen)" 'cd services/core && sqlc generate' 'cd services/rider && sqlc generate' \
      'cd services/payment && sqlc generate' 'npm run gen:api --workspace packages/ui --if-present'
    in_order "make -n prod-local" "$(make -n prod-local 2>&1)" 'npm run build --workspaces --if-present' '--profile prod up -d --wait' \
      'go run ./cmd/core-admin migrate' 'go run ./cmd/rider-admin migrate' 'go run ./cmd/payment-admin migrate' \
      'go run ./cmd/core;' 'go run ./cmd/rider;' 'go run ./cmd/payment;'
    printf 'package x\nfunc  f(){}\n' > services/payment/x.go
    out=$(make test-payment 2>&1); st=$?
    [ "$st" != 0 ] && printf '%s\n' "$out" | grep -q 'x.go' || fail "make test-payment on unformatted Go: exit $st, output: $out"
    exit $f
  ) || f=$((f+$?))
  rm -rf "$tmp"
  ;;
ci)
  python3 -c "
import yaml
d = yaml.safe_load(open('.github/workflows/ci.yml'))
assert list(d['jobs']) == ['core', 'rider', 'payment', 'web', 'e2e', 'spec'], list(d['jobs'])
j = d['jobs']['payment']
guard = \"hashFiles('services/payment/go.mod')\"
assert j['runs-on'] == 'ubuntu-latest'
assert j['services']['postgres']['image'] == 'postgres:16'
assert j['env']['SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL'] == 'postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment_test?sslmode=disable'
st = j['steps']
assert st[0]['uses'].startswith('actions/checkout@'), st[0]
assert all(guard in x.get('if', '') for x in st[1:]), 'a payment step lacks the hashFiles guard'
assert st[1]['if'] == guard + \" == ''\" and st[1]['run'] == 'echo \"payment: services/payment absent, skipping\"', st[1]
go = [x for x in st if x.get('uses', '').startswith('actions/setup-go@')]
assert go and go[0]['with']['go-version-file'] == 'services/payment/go.mod', go
runs = [x.get('run', '') for x in st]
i = [n for n, r in enumerate(runs) if '-f deploy/initdb.sql' in r]
t = [n for n, r in enumerate(runs) if r.strip() == 'make test-payment']
assert i and t and i[0] < t[0], runs
" || fail "ci.yml: payment job shape"
  ;;
docs)
  sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh >/dev/null 2>&1 || fail "the platform-readme-claude docs check fails"
  sh openspec/changes/archive/2026-10-16-platform-mobile-readme-spec/check-readme-mobile.sh >/dev/null 2>&1 || fail "the platform-mobile-readme-spec check fails"
  sh openspec/changes/archive/2026-10-16-platform-postman-tooling/check-tooling.sh docs >/dev/null 2>&1 || fail "the platform-postman-tooling docs check fails"
  r=$(cat README.md) c=$(cat CLAUDE.md)
  for p in ':8082' 'SHOPPERSTOP_PAYMENT_GATEWAY=fake' 'Cloned before Phase 5?' \
    'grep shopperstop_payment deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres' \
    '`make test-payment`' '`make payment`' 'shopperstop_payment_e2e' 'packages/ui/src/api/payment.d.ts' \
    'paymentBaseUrl' 'paymentId' '`payment` from Phase 5'; do has README.md "$r" "$p"; done
  grep -qF '](services/payment' README.md CLAUDE.md && [ ! -d services/payment ] && fail "a Markdown link points into the absent services/payment"
  for p in '`make test-payment`' '`make payment`' 'shopperstop_payment_e2e' '18082' '`payment` (`make test-payment`' \
    'shopperstop-payment.postman_collection.json' 'packages/ui/src/api/payment.d.ts' '`payment` (`services/payment/`' \
    'paymentBaseUrl' 'Phase 5'; do has CLAUDE.md "$c" "$p"; done
  grep -q '^services/payment/' CLAUDE.md || fail "CLAUDE.md layout has no line starting services/payment/"
  has .claude/commands/orchestrate.md "$(cat .claude/commands/orchestrate.md)" '`payment` (`services/payment/`'
  has .claude/commands/manage.md "$(cat .claude/commands/manage.md)" '`payment` = `services/payment/`'
  o=$(cat openspec/config.yaml)
  for p in 'payment (services/payment/)' 'payment-service' 'payment-gateway-razorpay'; do has openspec/config.yaml "$o" "$p"; done
  ;;
*) fail "unknown section: $s (want deploy, make, ci or docs)" ;;
esac; done

cd "$root" || exit 1
if [ "$f" -eq 0 ]; then echo "payment wiring check: ok"; else echo "payment wiring check: $f failures"; exit 1; fi
