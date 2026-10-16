# mobile-P4-L1-T5: Button and IconButton
Status: started
## Doing
Task 5 red written (`src/ui/button.test.tsx`); next: `button.tsx` green, then ticks.
## Found
- `IconButton` takes `icon` as a component type (`ComponentType<{ size?, color? }>`, which a Lucide icon satisfies) so the test needs no SVG and no runtime lucide import.
- `Button` variants: `primary`, `secondary`, `danger`, `ghost`, `ghostDanger`; sizes `md`, `lg`, `compact`; `loading`, `disabled`.
## Requests
(none)
## Blockers
(none)

## Red (5.1)

`npx jest --ci src/ui/button` with only `src/ui/button.test.tsx` committed:

```
FAIL src/ui/button.test.tsx
  ● Test suite failed to run

    Cannot find module './button' from 'src/ui/button.test.tsx'
Test Suites: 1 failed, 1 total
Tests:       0 total
```
