# ui-P3-L1-T1 - Button aria-disabled styling and compact size
Status: done
## Doing
Done: Button size="compact" and aria-disabled styling landed; tests green.
## Found
- `ButtonSize` is now `'md' | 'lg' | 'compact'`; `compact` is `h-11 px-2 sm:h-8` (44 px on phone, 32 px from sm).
- `aria-disabled:` styling sits on `base`, so `ButtonLink` and every `buttonClass` caller get it.
## Requests
## Blockers
