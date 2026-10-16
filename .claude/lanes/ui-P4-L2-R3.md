# ui-P4-L2 R3 - review of T3 (API client and full entry)
Status: done - approve
## Doing
Reviewed 80a749a, e70f9cf, dc25ba5, 77609a8, a0f0a43, ef66b70 against the brief, design 4 and the delta, and against the admin, rider and web api.ts.
## Found
- No blocking findings. All 11 client scenarios and "entry exports the shared helpers" have same-named tests in client.test.ts / index.test.ts.
- client.ts matches admin/rider behaviour: bearer set while a token exists; 401 clears and calls onUnauthorized only when the request's Authorization equals the current token; the envelope check is web's stricter code+message; the fallback keeps the status; globalThis.fetch is looked up per call.
- The .js deviation is sound. session.ts has no imports, time.ts imports only react, client.ts imports session as `import type` (erased), so the three .js specifiers in index.ts are the only extensionless-relative edges plain Node would hit. The tasks.md 3.3 check, run from a scratch dir with a symlinked package, prints `1 h 15 min ago 13 Oct 2026, 2:50 pm function undefined`. Vite and Metro resolve the .js form from dist.
- Test-first holds: 80a749a adds only tests (client.ts absent so it cannot load); dc25ba5 test precedes the 77609a8 fix. Scope is clean (client, index, their tests, T3 log).
- Gates in packages/ui: lint clean, typecheck clean, vitest 104/104, build ok.
## Nits (no action required)
1. index.test.ts:22 asserts on the source text (regex, count 3) not on loading; it also breaks when a fourth re-export is added. A spawned `node` import of dist would prove more, but needs a build first, so the source check is acceptable. Update the count with the next export.
2. The lane log lists the tasks.md 3.3 line as passing without pasting the output, which the brief asked for.
## Requests
None.
## Blockers
None.
