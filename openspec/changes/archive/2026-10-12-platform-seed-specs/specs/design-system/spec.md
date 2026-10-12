## ADDED Requirements

### Requirement: Semantic colour tokens only
Feature code in `apps/web`, `apps/admin` and `packages/ui` SHALL use colours only through the semantic tokens `brand`, `brand-strong`, `on-brand`, `accent`, `accent-hover`, `accent-soft`, `on-accent`, `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `focus`, `danger`, `danger-soft`, `warning`, `warning-soft`, `success`, `success-soft`, defined once in `packages/ui/src/tokens.css`.

#### Scenario: Literal colour fails the gate
- **WHEN** a source file under `src/` (other than `tokens.css`) contains a hex colour, a Tailwind palette utility such as `bg-gray-100`, `bg-white`, `text-white`, or a colour function such as `rgb(`
- **THEN** `no-literal-colors.test.ts` fails and names the file and the match

### Requirement: Type scale
Text SHALL use Inter (bundled, no CDN) at the scale display 28/34 700, h1 24/30 700, h2 20/26 700, h3 16/22 600, body 14/20 400, small 12/16 400, button 14/20 600, and prices and order numbers SHALL use tabular numerals.

#### Scenario: Price uses tabular numerals
- **WHEN** a `Price` renders
- **THEN** its element has the `tabular-nums` class

### Requirement: Shared components
`packages/ui` SHALL export Button, ButtonLink, IconButton, Input, FormField, Select, Stepper, Badge, Chip, Card, Dialog, Sheet, Table, EmptyState, ErrorBanner, StatusMessage, Skeleton, PageHeader, TabNav, Price, `formatInr` and `cn`, each with a test, and the apps SHALL compose pages from them rather than define one-off recipes.

#### Scenario: Stepper at zero stock
- **WHEN** a Stepper renders with `max` 0
- **THEN** it shows a disabled control labelled "Out of stock" and never calls `onChange`

#### Scenario: Stepper at the maximum
- **WHEN** a Stepper renders with `value` equal to `max`
- **THEN** the increment control is disabled and the decrement control is enabled

#### Scenario: Price formatting
- **WHEN** `formatInr` receives 123400, 123450 and 12345600
- **THEN** it returns `₹1,234`, `₹1,234.50` and `₹1,23,456`

### Requirement: Accessibility baseline
Every interactive element SHALL be keyboard reachable with a visible focus ring, tap targets on phone SHALL be at least 44 px, dialogs SHALL trap focus and close on Escape, icon-only controls SHALL carry `aria-label`, and `prefers-reduced-motion` SHALL disable transitions.

#### Scenario: Dialog closes on Escape
- **WHEN** a Dialog is open and the user presses Escape
- **THEN** `onClose` is called

#### Scenario: Axe on every e2e page
- **WHEN** the Playwright suite visits a page
- **THEN** `@axe-core/playwright` reports no violations
