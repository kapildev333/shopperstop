# rider-P5-L1-R1 - review of T1 (5a39265, 30ee9a9)
Status: done, verdict approve
## Findings
None blocking. Notes: payment_status stored as '' for cash (omitted via omitempty, never null or empty in JSON); migration 0004 is add column not null default '' (safe on existing rows); claim copies o.PaymentStatus; ready list passes both fields through; openapi schemas, enums and examples present; core's enum and omit semantics match services/core/openapi.json; deltas match code.
## Gates (scratch tree at 30ee9a9)
- GOFLAGS=-count=1 make test-rider: all ok
- make gen postman: git status clean (only my node_modules symlink)
- openspec validate --all --strict: 20 passed
