# Design

## Context
`packages/ui` does not exist. Root `package.json` already declares npm workspaces (`packages/*`, `apps/*`) and runs `lint`, `typecheck`, `test -- --run` across them and `build --workspace packages/ui` first. The seeded `design-system` spec fixes the token names, the component list and four scenarios; this change's delta pins the rest. Contract with the apps: they import `@shopperstop/ui` (components), `@shopperstop/ui/testing` (matcher, test-only) and `@shopperstop/ui/tokens.css` (preset). Versions below were installed and run in a scratch spike on 2026-10-12 (Vitest + jsdom focus trap, `Intl` formatting, Tailwind `compile`, ESLint flat config, `tsc`), on Node 22.23.

## Goals / Non-Goals
**Goals:** every export of Spec 1 §10 except `api/core.d.ts`, each with a test; tokens as the single source of colour, radius, shadow and type values; four gates green at every `feat:` commit; parallel worker tasks that never edit the same file.

**Non-Goals:** `api/core.d.ts` (deferred, below), app pages, Figma components and Code Connect, dark mode, Storybook, exit animations, scroll lock.

## Decisions

### Packaging
- `package.json`: `"name": "@shopperstop/ui"`, `"private": true`, `"type": "module"`, `"version": "0.0.0"`.
  - `exports`: `"."` → `{ "types": "./dist/index.d.ts", "default": "./dist/index.js" }`; `"./testing"` → `{ "types": "./dist/testing/literal-colors.d.ts", "default": "./dist/testing/literal-colors.js" }`; `"./tokens.css"` → `"./src/tokens.css"` (CSS is served from `src`, never copied).
  - scripts: `"build": "tsc -p tsconfig.build.json"`, `"typecheck": "tsc -p tsconfig.json"`, `"lint": "eslint ."`, `"test": "vitest"` (the gates pass `-- --run`).
  - `dependencies` (exact): `lucide-react` 1.55.0, `@fontsource-variable/inter` 5.3.0. `peerDependencies`: `react` and `react-dom` `^19.0.0`.
  - `devDependencies` (exact): `react` 19.3.0, `react-dom` 19.3.0, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/node` 22.20.5, `typescript` 6.0.3, `tailwindcss` 4.3.3, `vitest` 5.0.4, `vite` 8.3.4, `jsdom` 27.0.0, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1, `@testing-library/user-event` 14.6.7, `eslint` 9.39.5, `eslint-plugin-jsx-a11y` 6.10.2, `eslint-plugin-react-hooks` 7.1.1, `typescript-eslint` 8.71.2.
  - Version reasons: TypeScript 7 is out but `typescript-eslint` needs `<6.1` (and `openapi-typescript` 7.13 wants `^5`); ESLint 10 is out but `eslint-plugin-jsx-a11y` 6.10.2 declares only `^9`. `@testing-library/dom` is a required peer of `@testing-library/react`; `vite` is a required peer of `vitest`; `@types/*` type the allowed packages. `typescript-eslint` is the parser ESLint needs for TS; it and the implied dev tooling above are approved by PLAN.md D10.
- `tsconfig.json` (typecheck, no emit): `target` ES2022, `lib` [ES2022, DOM, DOM.Iterable], `module` ESNext, `moduleResolution` bundler, `jsx` react-jsx, `strict`, `noEmit`, `skipLibCheck`, `types` [node], `include` [src, scripts, vitest.config.ts].
- `tsconfig.build.json`: extends it; `noEmit` false, `declaration` true, `outDir` dist, `rootDir` src, `include` [src], `exclude` [src/**/*.test.ts, src/**/*.test.tsx, src/test-setup.ts].
- `vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`, `include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts']`; no globals (tests import from `vitest`). `src/test-setup.ts`: `import '@testing-library/jest-dom/vitest'` and `afterEach(cleanup)`.
- `eslint.config.js`: `tseslint.config({ ignores: ['dist'] }, tseslint.configs.recommended, jsxA11y.flatConfigs.recommended, reactHooks.configs.flat.recommended)`.
- Simplification: imports are extensionless and `dist` targets bundlers (Vite, Vitest). Ceiling: a plain-Node consumer (SSR) needs `nodenext` and `.js` import suffixes.
- Consumption by web and admin: add `"@shopperstop/ui": "*"` to the app's `dependencies` (npm links the workspace); the app's `src/index.css` is `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";` (nothing else defines colours, radii, shadows or type); the app's root layout sets `bg-canvas text-ink` on `body` (tokens.css sets no body colour, and Sheet's title inherits it); components come from `@shopperstop/ui` (its entry also imports the Inter font, so no font link in `index.html`); the app's `src/no-literal-colors.test.ts` uses `findLiteralColors` from `@shopperstop/ui/testing` (snippet under "Literal-colour matcher").
- Simplification: the apps import `dist`, so `packages/ui` is built before an app typechecks, tests, builds or runs dev (root `build` already orders it). Ceiling: a component change needs a rebuild (`tsc -p tsconfig.build.json --watch` in dev).

### One file per export group, index never edited after task 1
Task 1 writes `src/index.ts` once, complete:
```ts
import '@fontsource-variable/inter'
export * from './cn'
export * from './button'      // Button, ButtonLink, buttonClass, buttonVariantClass
export * from './icon-button'
export * from './input'       // Input, inputClass
export * from './form-field'
export * from './select'
export * from './price'       // Price, formatInr
export * from './stepper'
export * from './badge'
export * from './chip'
export * from './card'
export * from './table'
export * from './skeleton'
export * from './empty-state'
export * from './status-message'
export * from './page-header'
export * from './tab-nav'
export * from './dialog'      // Dialog, DialogFooter
export * from './sheet'
export * from './error-banner'
```
and each listed component file, plus `cn.ts` (until task 1's `feat:` commit fills it), as a placeholder containing only `export {}`, so the scaffold commit typechecks. A later task replaces its own placeholders wholesale. `typecheck`, `build` and `lint` are green on task 1's tree; every `feat:` commit is green on all four gates; parallel branches touch disjoint files, so they never conflict (except their own checkbox lines in `tasks.md`, which merge as separate hunks). A `test:` commit is red by design: its test imports a name the placeholder does not export yet. Chosen over a fully written index pointing at missing files (typecheck red until the last task lands) and over per-group barrel files (extra files for no runtime benefit).

### Tokens (`src/tokens.css`)
Order inside the file:
1. `:root { --brand: #F8CB46; ... }`, the 20 tokens with the Spec 1 §8.1 values except `--line-strong: #868C94` (PLAN.md D12 overrides §8.1's #C9CDD2), one per line, names exactly as the seed spec.
2. `@theme inline { --color-*: initial; --color-<token>: var(--<token>); ... }` for all 20. `inline` makes utilities read `var(--brand)` directly, so a later dark block only overrides `:root` values.
3. `@theme { ... }`:
   - `--shadow-*: initial; --inset-shadow-*: initial; --drop-shadow-*: initial; --text-shadow-*: initial;`
   - `--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08); --shadow-sheet: 0 -4px 16px rgba(0, 0, 0, 0.12);`
   - `--radius-control: 8px; --radius-card: 12px;` (pill = Tailwind's built-in `rounded-full`)
   - `--font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;`
   - type scale, for each of `display` 28/34/700, `h1` 24/30/700, `h2` 20/26/700, `h3` 16/22/600, `body` 14/20/400, `small` 12/16/400, `button` 14/20/600: `--text-<n>: <size>px; --text-<n>--line-height: <lh>px; --text-<n>--font-weight: <w>;`
   - `--default-transition-duration: 150ms; --default-transition-timing-function: ease-out;`
4. `@source "./";` so an app that imports this file also scans the package's class names.
5. `@layer base { :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; } @media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-iteration-count: 1 !important; } } }`

Spacing keeps Tailwind's default `--spacing: 0.25rem` (the 4 px grid). Simplification: Tailwind's default font sizes and radii stay available. Ceiling: nothing stops `text-lg`; add `--text-*: initial` if drift appears.

`src/tokens.test.ts` tests tokens two ways: reads the file as text for `:root` values and the font/`http` checks, and compiles it with Tailwind's own `compile` (no Vite, no PostCSS):
```ts
import { compile } from 'tailwindcss'
const req = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
async function build(candidates: string[]) {
  const c = await compile('@import "tailwindcss"; @import "./tokens.css";', {
    base: here,
    loadStylesheet: async (id: string, base: string) => {
      const path = id === 'tailwindcss' ? req.resolve('tailwindcss/index.css') : resolve(base, id)
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
    },
  })
  return c.build(candidates)
}
```
The "token values match the palette" expectation table uses `#868C94` for `line-strong` (D12). Contrast is computed in the same test from the `:root` values with the WCAG formula (`L = 0.2126 R + 0.7152 G + 0.0722 B` on linearised channels, ratio `(L1 + 0.05) / (L2 + 0.05)`). The "used pairs pass" test also asserts `line-strong` on `surface` is at least 3 (border rule; 3.39 with D12). The test file holds the expected hex values, so it is on the ignore list of the package's own literal-colour test.

### Colour use in components (contrast rule)
Measured: accent on accent-soft 4.36, success on success-soft 4.36, danger on danger-soft 4.01, ink-muted on canvas 4.47, line-strong on surface 3.39 and on canvas 3.14 (D12 value #868C94; the original #C9CDD2 measured 1.60). So: text on a `*-soft` surface is `ink` (or `accent-hover` on `accent-soft`, 5.97); status colours appear on soft surfaces only as icons and borders; `ink-muted` text sits on `surface` only; ghost buttons do not change background on hover (they underline).

### `cn` (`src/cn.ts`)
`export function cn(...parts: (string | false | null | undefined)[]): string { return parts.filter(Boolean).join(' ') }`. Ceiling: no class conflict merging (no `tailwind-merge`); a caller `className` that sets the same property as a base class wins only by CSS order. Callers pass layout classes (margin, width), not colours.

### Literal-colour matcher (`src/testing/literal-colors.ts`)
```ts
export function matchLiteralColors(text: string): string[]
export function findLiteralColors(dir: string, ignore: string[] = []): { file: string; match: string }[]
```
Patterns (case-insensitive, global):
- hex: `(?<![\w&/])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b`
- palette utility: `\b(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b`
- white/black: `\b(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|caret|shadow)-(?:white|black)\b`
- colour function: `\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(`
`findLiteralColors` walks `dir` recursively with `node:fs` (`readdirSync(dir, { recursive: true, encoding: 'utf8' })`; the encoding makes the entries typed `string[]`), reads `.ts`, `.tsx`, `.css` files, skips any file named `tokens.css` and every path in `ignore` (relative to `dir`, forward slashes), and returns matches in path order with `file` relative to `dir`. An app's test is:
```ts
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLiteralColors } from '@shopperstop/ui/testing'
test('no literal colours in src', () => {
  expect(findLiteralColors(dirname(fileURLToPath(import.meta.url)))).toEqual([])
})
```
Use `dirname(fileURLToPath(import.meta.url))`, not `new URL('.', import.meta.url)`: under jsdom the global `URL` is jsdom's and `fileURLToPath` rejects it ("The URL must be of scheme file"). The package's own `src/no-literal-colors.test.ts` is the same with `ignore = ['tokens.test.ts', 'testing/literal-colors.ts', 'testing/literal-colors.test.ts']`. Simplification: regexes over text, not a CSS or TS parser. Ceiling: a hex-looking anchor (`#add`) is a false positive; rename the anchor.

### Components: interfaces
Every component accepts `className` merged last through `cn` (including the ones whose prop list below omits it), spreads remaining native props, and gets `ref` as a plain prop (React 19). Icons are Lucide, 20 px, 16 px inside buttons, always `aria-hidden`.

- `button.tsx`: `type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ghost-danger'`; `type ButtonSize = 'md' | 'lg'`; `buttonVariantClass: Record<ButtonVariant, string>` (exported, the variant half of `buttonClass`); `buttonClass({ variant = 'primary', size = 'md' }): string`; `Button(props: ButtonHTMLAttributes & { variant?, size?, loading?: boolean })`; `ButtonLink(props: AnchorHTMLAttributes & { variant?, size? })`.
  - base: `inline-flex items-center justify-center gap-2 rounded-control text-button transition-colors disabled:cursor-not-allowed disabled:opacity-50`
  - primary `bg-accent text-on-accent hover:bg-accent-hover`; secondary `border border-line-strong bg-surface text-ink hover:bg-canvas`; ghost `text-accent hover:underline`; ghost-danger `text-danger hover:underline`
  - md `h-11 px-4 sm:h-10`; lg `h-12 px-6`
  - `type` defaults to `"button"`; `loading` → `disabled`, `aria-busy="true"`, `<Loader2 size={16} aria-hidden className="animate-spin" />` before the children.
- `icon-button.tsx`: `IconButton(props: Omit<ButtonHTMLAttributes, 'aria-label'> & { 'aria-label': string; icon: LucideIcon; variant?: 'ghost' | 'secondary' })`, `type="button"`, `inline-flex size-11 items-center justify-center rounded-control sm:size-10`, ghost `text-ink hover:bg-canvas`, secondary as Button's; icon `size={20}`.
- `input.tsx`: `inputClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-body text-ink placeholder:text-ink-muted aria-[invalid=true]:border-danger disabled:opacity-50 sm:h-10'`; `Input(props: ComponentPropsWithRef<'input'>)`.
- `form-field.tsx`: `FormField({ label: string; hint?: string; error?: string; children: ReactElement<AriaAttributes & { id?: string }> })`. Id = child's `id` or `useId()`. Renders `<div className="flex flex-col gap-1">` with `<label htmlFor={id} className="text-small font-semibold text-ink">`, the child via `cloneElement(child, { id, 'aria-describedby': <hint id> <error id>, 'aria-invalid': error ? true : undefined })`, hint `<p id={id + '-hint'} className="text-small text-ink-muted">`, error `<p id={id + '-error'} className="text-small text-danger">`.
- `select.tsx`: `Select(props: ComponentPropsWithRef<'select'>)`: `<div className="relative">` + `<select className={cn(inputClass, 'appearance-none pr-9', className)}>` + `<ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />`.
- `price.tsx`: `formatInr(cents: number): string` via `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: f, maximumFractionDigits: f })` with `f = cents % 100 === 0 ? 0 : 2`, applied to `cents / 100`. `Price({ cents: number; mrpCents?: number; className? })` → `<span className="inline-flex items-baseline gap-1 tabular-nums">` with `<span className="font-semibold text-accent">{formatInr(cents)}</span>` and, when `mrpCents > cents`, `<s className="text-small text-ink-muted"><span className="sr-only">MRP </span>{formatInr(mrpCents)}</s>`. Ceiling: needs full ICU (Node default, every browser).
- `stepper.tsx`: `Stepper({ value: number; max: number; label: string; onChange: (next: number) => void })`.
  - `max <= 0`: `<button type="button" disabled>Out of stock</button>`, whatever `value` is (seed scenario), classes `h-11 min-w-20 rounded-full border border-line-strong bg-surface px-4 text-button text-ink-muted disabled:cursor-not-allowed sm:h-9`.
  - `value === 0`: `<button type="button" aria-label={`Add ${label}`}>ADD</button>`, classes `h-11 min-w-20 rounded-full border border-accent bg-surface px-4 text-button text-accent sm:h-9`; click → `onChange(1)`. No hover background: `accent` on `accent-soft` is 4.36 < 4.5.
  - `value > 0`: `<div role="group" aria-label={`Quantity of ${label}`} className="inline-flex h-11 items-center rounded-full bg-accent text-on-accent sm:h-9">` with a `Minus` button `aria-label={`Remove one ${label}`}` (always enabled), `<span aria-live="polite" className="min-w-6 text-center tabular-nums">{value}</span>`, a `Plus` button `aria-label={`Add one ${label}`}` disabled when `value >= max`. Each inner button is `inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent-hover sm:size-9`.
  - Simplification: an out-of-stock cart line cannot be decremented through the Stepper; the cart drawer offers its own remove action (web area).
- `badge.tsx`: `Badge({ variant = 'neutral', children })` → `<span className="inline-flex items-center rounded-full px-2 text-small font-semibold text-ink {bg}">`, bg: neutral `bg-canvas`, success `bg-success-soft`, warning `bg-warning-soft`, danger `bg-danger-soft`, accent `bg-accent-soft`.
- `chip.tsx`: `Chip({ selected: boolean; ...button props })` → `<button type="button" aria-pressed={selected}>`, `h-11 rounded-full border px-4 text-body sm:h-9`, selected `border-accent bg-accent-soft text-accent-hover`, else `border-line-strong bg-surface text-ink`.
- `card.tsx`: `Card(props: HTMLAttributes<HTMLDivElement>)` → `rounded-card border border-line bg-surface shadow-card`.
- `table.tsx`: `type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode }`; `Table<T>({ columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; stack?: boolean; caption?: string })`. Native `<table className="w-full bg-surface text-body">`, `<caption className="sr-only">` when given, `<th scope="col" className="border-b border-line px-3 py-2 text-left text-small font-semibold text-ink-muted">`, `<td className="border-b border-line px-3 py-2">`. With `stack`: table, tbody, tr and td get `max-sm:block`, thead gets `max-sm:sr-only`, rows get `max-sm:py-2`, and each td starts with `<span className="text-small font-semibold text-ink-muted sm:hidden">{header}</span>`. Ceiling: some phone screen readers drop table semantics under `display: block`; the visible labels keep each value named.
- `skeleton.tsx`: `Skeleton({ variant: 'grid' | 'list' | 'table'; count?: number })`, `count` default 6. `<div role="status" aria-label="Loading">` with `count` children `<div aria-hidden data-skeleton className="animate-pulse bg-line ...">`: grid → container `grid grid-cols-2 gap-3 sm:grid-cols-4`, item `aspect-square rounded-card`; list → `flex flex-col gap-3`, item `h-16 rounded-card`; table → `flex flex-col gap-2`, item `h-10 rounded-control`.
- `empty-state.tsx`: `EmptyState({ title: string; description?: string; icon?: LucideIcon; action?: ReactNode })` → centred column (`flex flex-col items-center gap-2 text-center`), icon 20 px `text-ink-muted` aria-hidden, `<h2 className="text-h2 text-ink">`, `<p className="text-body text-ink-muted">`, action.
- `status-message.tsx`: `StatusMessage({ tone = 'neutral', children })`, tones `neutral | success | warning` → `<div role="status" className="flex items-center gap-2 rounded-control px-3 py-2 text-body text-ink {bg}">`, bg `bg-canvas` / `bg-success-soft` / `bg-warning-soft`, icon (`Info`, `CheckCircle2`, `AlertTriangle`, 16 px, aria-hidden, `text-ink-muted` / `text-success` / `text-warning`).
- `error-banner.tsx`: `ErrorBanner({ message: string; onRetry?: () => void })` → `<div role="alert" className="flex items-center gap-3 rounded-control border border-danger bg-danger-soft px-3 py-2 text-body text-ink">`, `AlertCircle` 20 px `text-danger` aria-hidden, message, and `<Button variant="secondary" onClick={onRetry}>Try again</Button>` when `onRetry`.
- `page-header.tsx`: `PageHeader({ title: string; description?: string; actions?: ReactNode })` → `<div className="flex flex-wrap items-start justify-between gap-4">` with a `<div>` holding `<h1 className="text-h1 text-ink">` and the description `<p className="text-body text-ink-muted">`, then actions in `flex gap-2`.
- `tab-nav.tsx`: `TabNav({ label: string; children })` → `<nav aria-label={label} className="flex gap-4 border-b border-line [&_a]:border-b-2 [&_a]:border-transparent [&_a]:py-3 [&_a]:text-body [&_a]:text-ink-muted [&_a[aria-current=page]]:border-accent [&_a[aria-current=page]]:font-semibold [&_a[aria-current=page]]:text-accent">`. Router-agnostic: TanStack Router's `Link` sets `aria-current="page"` on the active link, plain anchors set it by hand.
- `use-modal.ts` (internal, not exported): `useModal(open: boolean, onClose: () => void): RefObject<HTMLDivElement | null>`. In a `useEffect` keyed on `open`: remember `document.activeElement`; focus the first focusable element in the panel (selector `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`), or the panel itself (`tabIndex={-1}`); add a `document` `keydown` listener: Escape → `onClose()`; Tab on the last focusable (Shift+Tab on the first) → `preventDefault()` and focus the other end. With nothing focusable inside, Tab is prevented. `onClose` is kept in a ref, so an inline callback does not re-run the effect (and steal focus) on every render. Cleanup removes the listener and refocuses the remembered element. A document listener, not `onKeyDown` on the panel: `jsx-a11y` rejects key handlers on non-interactive elements, and Escape must work wherever focus is.
- `dialog.tsx`: `Dialog({ open: boolean; onClose: () => void; title: string; children })` → `null` when closed; else `createPortal` into `document.body`: backdrop `fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4`, panel `<div ref role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="w-full max-w-md rounded-card bg-surface p-6 shadow-sheet">` with `<h2 id={titleId} className="text-h2 text-ink">`. `DialogFooter({ onCancel: () => void; cancelLabel?: string; children?: ReactNode })` → `<div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>{cancelLabel ?? 'Cancel'}</Button>{children}</div>`.
- `sheet.tsx`: `Sheet({ open: boolean; onClose: () => void; title: string; children })`, same portal and `useModal`; backdrop `fixed inset-0 z-50 bg-ink/40`; panel `fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-card bg-surface shadow-sheet transition-transform duration-200 starting:translate-y-full sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-card sm:starting:translate-x-full sm:starting:translate-y-0`; header `flex items-center justify-between border-b border-line px-4 py-3` with `<h2 className="text-h3">` (colour inherited from the app's `body`, which sets `text-ink`) and `<IconButton aria-label="Close" icon={X} onClick={onClose} />`; body `p-4`.
- Simplifications in modals: entry animation via CSS `@starting-style` (`starting:` variant), no exit animation; no background `inert` and no scroll lock (`aria-modal` plus the focus trap); no backdrop-click close. Ceiling: add `inert` on the app root and scroll lock if a screen-reader or scroll bug is reported.

### `api/core.d.ts`: deferred
`services/core/openapi.json` does not exist, and generating from a placeholder document would commit a fake contract. This change adds no `openapi-typescript` dependency, no script and no `./api` export. When core lands `openapi.json`, a follow-up ui change adds `openapi-typescript` (its peer range `^5` conflicts with TypeScript 6 and must be resolved then), a `gen:api` script writing `src/api/core.d.ts`, the generated file and an `"./api"` types export; `make gen` (platform) calls that script. Ceiling: the apps have no typed API client until then; Phase 1 shells only call `/healthz`.

### Figma token check (`scripts/check-figma-tokens.mjs`)
Usage `node scripts/check-figma-tokens.mjs <export.json> [tokens.css]`, the CSS defaulting to `../src/tokens.css` relative to the script. Reads `:root { --<name>: <hex>; }` from the CSS. Walks the JSON: a leaf is an object with `$value`; its token name is its own key; its value is `$value` when a string, else `$value.hex`. Hex values are compared upper-cased, with an `FF` alpha suffix on 8-digit values dropped. Output, sorted by name: `mismatch <name>: css <hex>, figma <hex>`, `missing in figma: <name>`, `missing in css: <name>`; exit 1 if any line, else prints `figma tokens match tokens.css (<n> colours)` and exits 0; no argument or unreadable file → usage on stderr, exit 2. Test `scripts/check-figma-tokens.test.ts` (first line `// @vitest-environment node`) runs the script with `spawnSync(process.execPath, [...])` on `scripts/fixtures/figma-tokens-match.json` (20 tokens nested under `{"color": {...}}`, some in the `{"$value": {"hex": ...}}` form) and `scripts/fixtures/figma-tokens-drift.json`. Simplification: colours only. Ceiling: type and spacing variables are not compared; add when the Figma file defines them as variables.

## Files
All in area ui (`packages/ui/`): `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.js`, `src/index.ts`, `src/test-setup.ts`, `src/tokens.css`, `src/tokens.test.ts`, `src/cn.ts`, `src/cn.test.ts`, `src/no-literal-colors.test.ts`, `src/testing/literal-colors.ts`, `src/testing/literal-colors.test.ts`, `src/use-modal.ts`, `src/{button,icon-button,input,form-field,select,price,stepper,badge,chip,card,table,skeleton,empty-state,status-message,page-header,tab-nav,dialog,sheet,error-banner}.tsx` and a `.test.tsx` beside each, `scripts/check-figma-tokens.mjs`, `scripts/check-figma-tokens.test.ts`, `scripts/fixtures/figma-tokens-{match,drift}.json`. Plus `openspec/changes/ui-packages-ui/**`. Root `package-lock.json` changes mechanically on `npm install`. Differences from the plan's file list: `cn.ts` not `cn.tsx` (no JSX); `use-modal.ts` and `error-banner.tsx`/`tokens.test.ts` added; `api/core.d.ts` deferred.

## Risks / Trade-offs
- [Vite 8, Vitest 5 and jsdom need Node 22.12 or newer; on 22.11 npm skips Rolldown's native binding and jsdom fails on `require(esm)`] → resolved by PLAN.md D11: root `engines.node` is `>=22.12.0`; lanes put `~/.local/node-v22.23.3/bin` first on PATH. Spike ran green on Node 22.23.3.
- [`line-strong` borders measured 1.60:1 with #C9CDD2] → resolved by PLAN.md D12: #868C94, 3.39:1 on surface, pinned by the contrast test.
- [ESLint 9.39.5 is end of life] → pinned until `eslint-plugin-jsx-a11y` supports ESLint 10.
- [`@source "./"` inside an imported stylesheet] → apps verify that package classes are generated (web and admin build checks).
- [The seed's "Axe on every e2e page"] → not testable in this package; web and admin Playwright suites own it.
