# Figma

File: **ShopperStop**, https://www.figma.com/design/pUvvBVQbwM8287Q3Fji8G1 (owner's Drafts, D7). Built with the Figma MCP tools on 2026-10-12 (plan Task 14).

The owner's Figma plan is Starter, which allows three pages per file and a daily MCP tool-call cap (PLAN.md D17). Spec 1 §9 asked for five pages; the content is the same, laid out as three pages with sections:

| Page | Sections | Contents |
|---|---|---|
| Tokens & Components | `Tokens`, `Components` | Variables: collection `Color` (mode `Light`, 20 `color/<token>` variables named exactly as Spec 1 §8.1, `line-strong` = `#868C94` per D12), `Spacing` (`spacing/1` … `spacing/12` on the 4 px grid), `Shape` (`radius/control` 8, `radius/card` 12, `radius/pill`). Every variable carries WEB code syntax `var(--color-<token>)`, `var(--spacing-<n>)`, `var(--radius-<k>)`. Text styles `display`, `h1`, `h2`, `h3`, `body`, `small`, `button` (Inter, §8.2). Effect styles `shadow-card`, `shadow-sheet`. A token sheet renders every swatch, the type ramp and the shapes. Component sets, one per `packages/ui` export: Button (Style × Size), Badge (Tone), Chip (Selected), Stepper (State), Price (MRP), Input (State), FormField (Error), Select, IconButton (Style), Card, EmptyState, ErrorBanner, StatusMessage (Tone), Skeleton (Variant), PageHeader, TabNav, Dialog (with DialogFooter, Cancel first), Sheet (Placement), Table (Mode table / stack). Every fill, stroke and radius is bound to a variable. |
| Customer web | `Phone 390`, `Desktop 1280` | One frame per Spec 2 §7 page: Home (with pincode sheet, not-serviceable, loading, error), Category, Product, Search (with empty), Cart drawer (bottom sheet on phone, side drawer on desktop; with empty, loading, error), Checkout (with out-of-stock line), Order tracking (with loading, error), Orders, Account, Sign in, Register. |
| Admin web | `Admin 1280` | One frame per Spec 2 §8 page: Sign in, Dashboard, Orders board (plus empty, History tab, detail sheet, cancel dialog, store-staff nav), Stock (inline edit, empty), Stores and Store form (pincode editor), Categories tree, Products and Product form (image upload), Staff with invite dialog. |

Mobile: the customer mobile app's screens (Phase 4, D36) live in the design canvas **ShopperStop App Design**, https://claude.ai/artifact/75BFgGxUe3viRFjgvn8Ywy: 19 artboards at 390×844, with the same token names and values as `packages/ui/src/tokens.css`. The canvas is the mobile design source; the Figma file has no `Mobile` page (Starter page limit, D17) and gets none in Phase 4.

## Keeping it in sync

- `packages/ui/src/tokens.css` is the source of truth for values; `packages/ui/scripts/check-figma-tokens.mjs` diffs a Figma variables JSON export (Color collection, Light mode) against it. Variable names map as `color/<token>` → `--color-<token>`.
- A screen changed in code is pushed back to Figma in the same PR's lane (Spec 1 §9). Code Connect mapping of `packages/ui` components to these component sets is the first design follow-up once the MCP call budget resets.
- Known nits for the next pass: the Orders board column badges show the Badge default text instead of counts; IconButton icons are placeholder circles (Lucide 20 px in code).
