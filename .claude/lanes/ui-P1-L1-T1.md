# ui-P1-L1-T1 - packages/ui task 1: scaffold, tokens, cn, literal-colour matcher (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 1 done on lane/ui-P1-L1-packages-ui: scaffold commit, red test commit, feat commit (tokens, cn, matcher). All four gates green on Node 22.23.3. Waiting for review; task 2 not started.
## Found
- Scaffold placeholder list: design.md does not list `cn.ts` among the placeholders, but `src/index.ts` exports `./cn` and must be green on the scaffold commit, so `cn.ts` is an `export {}` placeholder in the scaffold commit; the feat commit replaces it.
- In the jsdom test environment the global `URL` is jsdom's, so `fileURLToPath(new URL('.', import.meta.url))` throws "The URL must be of scheme file". Use `dirname(fileURLToPath(import.meta.url))` (string argument). The design.md snippet for app tests has the same pattern; apps running under jsdom will hit it too.
- `readdirSync(dir, { recursive: true })` is typed `string | Buffer` in @types/node 22.20; pass `encoding: 'utf8'`.
- Root `npm install` rewrote `package-lock.json` (formatting, the `node` engine line, reordering). No pre-existing package changed version; the diff is mechanical.
- `npm install` reports 6 vulnerabilities (2 moderate, 4 high) in the existing root tree (`openapi-to-postmanv2`), not in packages/ui; not addressed here.
## Requests
- to ui-P1-L1 (team lead): decide whether the `fileURLToPath(new URL(...))` snippet in design.md should change for the app tests (apps use jsdom too).
## Blockers
