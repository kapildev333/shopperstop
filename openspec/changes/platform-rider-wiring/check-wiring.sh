#!/bin/sh
# Checks the platform-rider-wiring scenarios that have no other test: deploy files, Makefile, CI, docs.
# Run from the repository root: sh openspec/changes/platform-rider-wiring/check-wiring.sh [deploy] [make] [ci] [docs]
# (no argument runs every section). Starts nothing: real runs only for targets that skip, make -n otherwise.
# Prints one FAIL line per gap; the last line is "wiring check: ok" or "wiring check: N failures".
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
create database shopperstop_rider_e2e owner shopperstop_rider;"
  [ "$(cat deploy/initdb.sql)" = "$want" ] || fail "deploy/initdb.sql is not the eight statements"
  c=$(cat deploy/Caddyfile)
  for p in 'handle /api/core/* {' 'reverse_proxy host.docker.internal:8080' 'handle /api/rider/* {' 'reverse_proxy host.docker.internal:8081' \
    'handle /admin/* {' 'uri strip_prefix /admin' 'root * /srv/apps/admin/dist' 'handle /rider/* {' 'uri strip_prefix /rider' \
    'root * /srv/apps/rider/dist' 'root * /srv/apps/web/dist'; do has Caddyfile "$c" "$p"; done
  [ "$(grep -c 'try_files {path} /index.html' deploy/Caddyfile)" = 3 ] || fail "Caddyfile: want try_files in three blocks"
  lacks Caddyfile "$c" 'root * /srv/web'
  lacks Caddyfile "$c" 'root * /srv/admin'
  python3 -c "
import yaml,sys
d=yaml.safe_load(open('deploy/docker-compose.yml'))
c=d['services']['caddy']
assert c['profiles']==['prod'], c['profiles']
assert c['volumes']==['./Caddyfile:/etc/caddy/Caddyfile:ro','../apps:/srv/apps:ro'], c['volumes']
" || fail "compose caddy: want profile prod and exactly the Caddyfile and ../apps mounts"
  ;;
make)
  # Today's tree: services/rider and apps/rider absent.
  if [ -d services/rider ] || [ -d apps/rider ]; then fail "make section needs a tree without services/rider and apps/rider"; fi
  for t in rider test-rider; do
    out=$(make "$t" 2>&1); st=$?
    [ "$st" = 0 ] && [ "$out" = "$t: services/rider absent, skipping" ] || fail "make $t: exit $st, output: $out"
  done
  out=$(make rider-app 2>&1); st=$?
  [ "$st" = 0 ] && [ "$(printf '%s\n' "$out" | tail -1)" = "rider-app: apps/rider absent, skipping" ] || fail "make rider-app: exit $st, last line: $(printf '%s\n' "$out" | tail -1)"
  printf '%s\n' "$out" | grep -q 'go run' && fail "make rider-app ran go"
  for t in seed e2e prod-local; do
    has "make -n $t" "$(make -n $t 2>&1)" "else echo \"$t: services/rider absent, skipping\"; fi"
  done
  has "make -n gen" "$(make -n gen 2>&1)" 'else echo "gen: services/rider/sqlc.yaml absent, skipping"; fi'
  in_order "make -n seed (core kept)" "$(make -n seed)" 'go run ./cmd/core-admin migrate' 'go run ./cmd/core-admin seed-demo --reset' 'test -d services/rider'
  in_order "make -n e2e (core kept)" "$(make -n e2e)" 'go run ./cmd/core-admin migrate' 'test -d services/rider' 'npm run build --workspaces --if-present' 'npm run e2e --workspaces --if-present'
  in_order "make -n gen (core kept)" "$(make -n gen)" 'cd services/core && sqlc generate' 'cd services/rider && sqlc generate' 'npm run gen:api --workspace packages/ui --if-present'

  # Every part present: a scratch copy of the Makefile, never this tree.
  tmp=$(mktemp -d)
  cp Makefile "$tmp/"
  (
    f=0
    cd "$tmp" || exit 1
    mkdir -p services/core services/rider apps/web apps/admin apps/rider packages/ui
    touch services/core/sqlc.yaml services/rider/sqlc.yaml
    echo '{"name":"scratch","private":true,"workspaces":["packages/*","apps/*"]}' > package.json
    out=$(env -u SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN make -n dev 2>&1)
    in_order "make -n dev" "$out" 'up -d --wait postgres' 'go run ./cmd/core-admin migrate' 'go run ./cmd/core-admin seed-demo --reset' \
      'go run ./cmd/rider-admin migrate' 'go run ./cmd/rider-admin seed-demo --reset' '-j5 core rider web admin rider-app' \
      'go run ./cmd/core;' 'go run ./cmd/rider;' 'npm run dev --workspace apps/web' 'npm run dev --workspace apps/admin' 'npm run dev --workspace apps/rider'
    core=$(make -n core) rider=$(make -n rider)
    tok=$(printf '%s' "$rider" | sed -n "s/.*SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN='\([^']*\)'.*/\1/p")
    [ -n "$tok" ] || fail "make -n rider: empty SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN"
    has "make -n core" "$core" "SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:$tok'"
    has "make -n core" "$core" "SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175'"
    for p in "SHOPPERSTOP_RIDER_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider?sslmode=disable'" \
      "SHOPPERSTOP_RIDER_ADDR=':8081'" "SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175'" \
      "SHOPPERSTOP_RIDER_CORE_URL='http://localhost:8080'" 'go run ./cmd/rider;'; do has "make -n rider" "$rider" "$p"; done
    pep=$(printf '%s' "$rider" | sed -n "s/.*SHOPPERSTOP_RIDER_SESSION_PEPPER='\([^']*\)'.*/\1/p")
    [ "${#pep}" -ge 32 ] || fail "make -n rider: pepper shorter than 32 bytes"
    has "make -n rider override" "$(make -n rider SHOPPERSTOP_RIDER_ADDR=:9091)" "SHOPPERSTOP_RIDER_ADDR=':9091'"
    in_order "make -n test" "$(make -n test 2>&1)" 'cd services/core && test -z' 'cd services/rider && test -z' \
      "SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -race ./..." 'npm run lint'
    out=$(SHOPPERSTOP_RIDER_DATABASE_URL=leak SHOPPERSTOP_CORE_DATABASE_URL=leak make -n e2e 2>&1)
    lacks "make -n e2e" "$out" leak
    in_order "make -n e2e" "$out" 'go run ./cmd/core-admin migrate' 'go run ./cmd/rider-admin migrate' 'go run ./cmd/rider-admin seed-demo --reset' 'npm run build --workspaces --if-present' 'npm run e2e --workspaces --if-present'
    e2e=$(printf '%s\n' "$out" | grep -F 'npm run e2e')
    for p in "shopperstop_rider_e2e" "SHOPPERSTOP_RIDER_ADDR=':18081'" "SHOPPERSTOP_RIDER_CORE_URL='http://localhost:18080'" \
      "SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175'" \
      "SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175'"; do has "make -n e2e npm run e2e" "$e2e" "$p"; done
    etok=$(printf '%s' "$e2e" | sed -n "s/.*SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN='\([^']*\)'.*/\1/p")
    [ -n "$etok" ] && [ "$etok" != "$tok" ] || fail "make -n e2e: rider token empty or equal to the dev token"
    has "make -n e2e npm run e2e" "$e2e" "SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:$etok'"
    in_order "make -n gen" "$(make -n gen)" 'cd services/core && sqlc generate' 'cd services/rider && sqlc generate' 'npm run gen:api --workspace packages/ui --if-present'
    in_order "make -n prod-local" "$(make -n prod-local 2>&1)" 'npm run build --workspaces --if-present' '--profile prod up -d --wait' \
      'go run ./cmd/core-admin migrate' 'go run ./cmd/rider-admin migrate' 'go run ./cmd/core;' 'go run ./cmd/rider;'
    printf 'package x\nfunc  f(){}\n' > services/rider/x.go
    out=$(make test-rider 2>&1); st=$?
    [ "$st" != 0 ] && printf '%s\n' "$out" | grep -q 'x.go' || fail "make test-rider on unformatted Go: exit $st, output: $out"
    exit $f
  ) || f=$((f+$?))
  rm -rf "$tmp"
  ;;
ci)
  python3 -c "
import yaml
d = yaml.safe_load(open('.github/workflows/ci.yml'))
assert list(d['jobs']) == ['core', 'rider', 'web', 'e2e', 'spec'], list(d['jobs'])
j = d['jobs']['rider']
guard = \"hashFiles('services/rider/go.mod')\"
assert j['runs-on'] == 'ubuntu-latest'
assert j['services']['postgres']['image'] == 'postgres:16'
assert j['env']['SHOPPERSTOP_RIDER_TEST_DATABASE_URL'] == 'postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable'
st = j['steps']
assert st[0]['uses'].startswith('actions/checkout@'), st[0]
assert all(guard in x.get('if', '') for x in st[1:]), 'a rider step lacks the hashFiles guard'
assert st[1]['if'] == guard + \" == ''\" and st[1]['run'] == 'echo \"rider: services/rider absent, skipping\"', st[1]
go = [x for x in st if x.get('uses', '').startswith('actions/setup-go@')]
assert go and go[0]['with']['go-version-file'] == 'services/rider/go.mod', go
runs = [x.get('run', '') for x in st]
i = [n for n, r in enumerate(runs) if '-f deploy/initdb.sql' in r]
t = [n for n, r in enumerate(runs) if r.strip() == 'make test-rider']
assert i and t and i[0] < t[0], runs
" || fail "ci.yml: rider job shape"
  ;;
docs)
  sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh >/dev/null 2>&1 || fail "the platform-readme-claude docs check fails"
  r=$(cat README.md) c=$(cat CLAUDE.md)
  for p in ':8081' ':5175/rider/' 'rider1-koramangala@shopperstop.local' 'rider12345' 'rider-admin seed-demo --reset' \
    'grep shopperstop_rider deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres' \
    '`make test-rider`' '`make rider`' '`make rider-app`'; do has README.md "$r" "$p"; done
  for p in '`make test-rider`' 'shopperstop_rider_e2e' '18081' '15175' '`rider` (`make test-rider`' 'shopperstop-rider.postman_collection.json' \
    'packages/ui/src/api/rider.d.ts' '`rider-app`'; do has CLAUDE.md "$c" "$p"; done
  ;;
*) fail "unknown section: $s (want deploy, make, ci or docs)" ;;
esac; done

cd "$root" || exit 1
if [ "$f" -eq 0 ]; then echo "wiring check: ok"; else echo "wiring check: $f failures"; exit 1; fi
