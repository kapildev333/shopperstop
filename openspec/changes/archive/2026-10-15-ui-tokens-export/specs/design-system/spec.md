## ADDED Requirements

### Requirement: Token values as a TypeScript module
`packages/ui` SHALL commit `src/tokens.ts`, generated from `src/tokens.css` by `scripts/gen-tokens.mjs` through the `gen:tokens` script, and SHALL export it as `@shopperstop/ui/tokens` with no DOM, React or CSS import; a test SHALL fail when the committed module differs from a fresh generation.

#### Scenario: Generated tokens match tokens.css
- **WHEN** `generateTokens` from `scripts/gen-tokens.mjs` runs in memory on the committed `src/tokens.css`
- **THEN** its output equals the committed `src/tokens.ts` byte for byte

#### Scenario: A drifted tokens.css fails the check
- **WHEN** `generateTokens` runs on `tokens.css` with `--brand` changed from `#F8CB46` to `#F8CB47`
- **THEN** its output differs from the committed `src/tokens.ts` and contains `"brand": "#F8CB47"`

#### Scenario: Package exports tokens and format
- **WHEN** `packages/ui/package.json` is read
- **THEN** `exports["./tokens"]` is `{ types: "./dist/tokens.d.ts", default: "./dist/tokens.js" }`, `exports["./format"]` is `{ types: "./dist/format.d.ts", default: "./dist/format.js" }`, and `scripts["gen:tokens"]` is `node scripts/gen-tokens.mjs`

### Requirement: Token module shape
`src/tokens.ts` SHALL export `colors` (every `:root` colour keyed by its camelCase name), `radius` (`control`, `card`, `pill`), `spacing` (`unit`, `gutter`, `gridGap`), `type` (`display`, `h1`, `h2`, `h3`, `body`, `small`, `button`, each with `size`, `lineHeight`, `weight`), `motion` (`duration`, `sheetDuration`, `easing`) and `shadows` (`card`, `sheet`, each with `boxShadow`, `offsetX`, `offsetY`, `blur`, `color`, `opacity`); lengths SHALL be numbers in px and durations numbers in ms.

#### Scenario: Every colour token is exported by camelCase name
- **WHEN** `colors` is imported from `src/tokens.ts`
- **THEN** it has exactly 20 keys, the camelCase forms of the 20 `:root` tokens, `colors.brand` is `#F8CB46`, `colors.brandStrong` is `#E5B51F` and `colors.lineStrong` is `#868C94`

#### Scenario: Scale values are numbers in px and ms
- **WHEN** `type`, `radius`, `spacing` and `motion` are imported from `src/tokens.ts`
- **THEN** `type.display` is `{ size: 28, lineHeight: 34, weight: 700 }`, `type.h3` is `{ size: 16, lineHeight: 22, weight: 600 }`, `type.body` is `{ size: 14, lineHeight: 20, weight: 400 }`, `radius` is `{ control: 8, card: 12, pill: 9999 }`, `spacing` is `{ unit: 4, gutter: 16, gridGap: 12 }` and `motion` is `{ duration: 150, sheetDuration: 200, easing: 'ease-out' }`

#### Scenario: Shadows carry offsets, blur, colour and opacity
- **WHEN** `shadows` is imported from `src/tokens.ts`
- **THEN** `shadows.card` is `{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)', offsetX: 0, offsetY: 1, blur: 3, color: '#000000', opacity: 0.08 }` and `shadows.sheet` is `{ boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.12)', offsetX: 0, offsetY: -4, blur: 16, color: '#000000', opacity: 0.12 }`

## MODIFIED Requirements

### Requirement: Semantic colour tokens only
Feature code in `apps/web`, `apps/admin` and `packages/ui` SHALL use colours only through the semantic tokens `brand`, `brand-strong`, `on-brand`, `accent`, `accent-hover`, `accent-soft`, `on-accent`, `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `focus`, `danger`, `danger-soft`, `warning`, `warning-soft`, `success`, `success-soft`, defined once in `packages/ui/src/tokens.css`; the generated `packages/ui/src/tokens.ts` is the only other file in `packages/ui/src/` that holds colour values.

#### Scenario: Literal colour fails the gate
- **WHEN** a source file under `src/` (other than `tokens.css`) contains a hex colour, a Tailwind palette utility such as `bg-gray-100`, `bg-white`, `text-white`, or a colour function such as `rgb(`
- **THEN** `no-literal-colors.test.ts` fails and names the file and the match

#### Scenario: Generated token module is exempt
- **WHEN** `packages/ui/src/no-literal-colors.test.ts` scans `packages/ui/src/` with the committed `tokens.ts`, which holds hex colours and `rgba(`
- **THEN** `matchLiteralColors` finds colours in `tokens.ts`, yet the scan with the test's ignore list reports no match from `tokens.ts`

### Requirement: Price shows MRP when discounted
`Price` SHALL render `formatInr(cents)` in the `accent` colour and, when `mrpCents` is greater than `cents`, the MRP after it struck through in `ink-muted`, with "MRP" available to assistive technology; `formatInr(0)` SHALL be `₹0`. `formatInr` SHALL be defined in `src/format.ts`, a module with no imports, exported as `@shopperstop/ui/format` and still exported from `@shopperstop/ui`.

#### Scenario: Discounted price shows MRP
- **WHEN** a Price renders with `cents` 9900 and `mrpCents` 12000
- **THEN** it shows `₹99` and a struck-through `₹120` whose accessible text includes "MRP"

#### Scenario: No discount, no MRP
- **WHEN** a Price renders with `mrpCents` equal to `cents` or absent
- **THEN** no struck-through element is rendered

#### Scenario: Zero rupees
- **WHEN** `formatInr` receives 0
- **THEN** it returns `₹0`

#### Scenario: formatInr imports nothing
- **WHEN** `src/format.ts` is read and `formatInr` is called from it in a Vitest file running in the `node` environment (no DOM)
- **THEN** the file contains no `import` statement, and `formatInr` returns `₹1,234`, `₹1,234.50` and `₹0` for 123400, 123450 and 0

#### Scenario: The entry still exports formatInr
- **WHEN** `formatInr` is imported from `src/index.ts` and from `src/format.ts`
- **THEN** both are the same function
