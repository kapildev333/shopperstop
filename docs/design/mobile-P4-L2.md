# mobile-P4-L2 - screen and module data for `mobile-serviceability-catalog`

Why this file exists: the workers cannot open the design canvas (D36). This file carries what they need from artboards 1 Home, 2 Category, 3 Product, 7 Pincode sheet, 8 Not serviceable / closed, 13 Search, 17 Change pincode and 18 Loading, translated into token names and React Native terms, plus the module interfaces. Behaviour is in `openspec/changes/mobile-serviceability-catalog/specs/mobile-app/spec.md`, decisions in that change's `design.md`. Where this file and the spec disagree, the spec wins; tell the team lead.

Conventions are `docs/design/mobile-P4-L1.md`'s: sizes in points at 390 wide; colours are the camelCase keys of `colors` from `src/ui/tokens.ts`, never a value; type names are `Text` variants (`display` 28/34 700, `h1` 24/30 700, `h2` 20/26 700, `h3` 16/22 600, `body` 14/20 400, `small` 12/16 400, `button` 14/20 600); weight 600 or 700 on a `body`/`small` text means `style={{ fontFamily: fontFamily(600) }}`; radius `radius.control` 8, `radius.card` 12, `radius.pill`; shadows `boxShadow: shadows.card.boxShadow` / `shadows.sheet.boxShadow`. Every style goes in `StyleSheet.create`. Prices and counts use `tabular`. The canvas draws image placeholders in a grey that is not a token: use `canvas`.

Icons (`lucide-react-native` 1.55.0): Back `ChevronLeft`, Account `User`, Search `Search`, Clear `X`, pincode chevron `ChevronDown` (16), notice pin `MapPinOff` (44), notice clock `Clock` (44), search empty `SearchX` (36), store change `ShoppingBag` (24), Stepper `Minus` / `Plus` (16), image placeholder `ShoppingBasket` (20), status icons `Info`, `CircleCheck`, `TriangleAlert` (16).

## Primitives (`src/ui/`)

### Price (`price.tsx`)

```ts
export function Price(props: { cents: number; mrpCents?: number; size?: 'md' | 'lg'; layout?: 'row' | 'column' }): JSX.Element
```
`formatInr` from `@shopperstop/ui/format` (never reimplemented). Price: `md` `body` 600 `accent`; `lg` 20/26 700 `accent` (use `type.h2` size and line height). MRP, only when `mrpCents > cents`: `small` `inkMuted`, `textDecorationLine: 'line-through'`, `accessibilityLabel` "MRP ₹30" (the visible text is "₹30"). `layout` `column` (cards: MRP under the price) or `row` (product bar: MRP beside, gap 6, baseline). All text `tabular`.
Test `src/ui/price.test.tsx`: `price in rupees` (2900 shows "₹29", colour `accent`), `mrp struck through when higher` ("₹30" with line-through and the label "MRP ₹30"), `no mrp when equal`, `paise shown` (123450 shows "₹1,234.50"), `large size`.

### Stepper (`stepper.tsx`)

```ts
export function Stepper(props: { label: string; value: number; max: number; onChange: (next: number) => void; size?: 'md' | 'lg' }): JSX.Element
```
- `max <= 0`: a disabled button "Out of stock": height 36 (`lg` 48), padding horizontal 10, `radius.pill`, border 1 `lineStrong`, `surface`, text `small` 600 `inkMuted`.
- `value === 0`, `md`: button named "Add <label>", text "ADD" (`button`, `accent`), height 36, min width 64, padding horizontal 12, `radius.pill`, border 1 `accent`, `surface`; `onChange(1)`.
- `value === 0`, `lg`: the primary `Button` `lg` "Add to cart" with `accessibilityLabel` "Add <label>", padding horizontal 28.
- `value > 0`: a `View` `role="group"` `accessibilityLabel` "Quantity of <label>", height 36 (`lg` 48), `radius.pill`, `accent` background; "Remove one <label>" (`Minus` 16 `onAccent`, 28 wide, `lg` 48), the count (`button`, `onAccent`, tabular, min width 16, `lg` 24, centred, `accessibilityLiveRegion="polite"`), "Add one <label>" (`Plus`), disabled with opacity 0.5 when `value >= max`.
- Every pressable in `md` carries `hitSlop` so its touch area is at least 44 × 44.
Test `src/ui/stepper.test.tsx`: `stepper counts within the maximum` (spec scenario), `out of stock is disabled`, `large add reads Add to cart`.

### Dialog (`dialog.tsx`)

```ts
export function Dialog(props: { open: boolean; title: string; onClose: () => void; children: ReactNode }): JSX.Element
export function DialogFooter(props: { children: ReactNode }): JSX.Element
```
The shape mobile-P4-L4a asked for. React Native `Modal` (`transparent`, `animationType="fade"`, `onRequestClose={onClose}`, `accessibilityLabel={title}`). Backdrop: full-screen `View`, `colors.ink` at opacity 0.5, not pressable. Panel: 16 from the left and right, vertically centred, `surface`, `radius.card`, padding 20, gap 16, `boxShadow: shadows.sheet.boxShadow`, `accessibilityViewIsModal`; the title `Text variant="h2" heading={2}`, then `children`. `DialogFooter`: a row, gap 12, each child wrapped in a `View` with `flex: 1`; callers put Cancel first. On the web export the dialog role arrives after the fade, as with sheets (L1 Decision 8): e2e waits for `getByRole('dialog', { name })`.
Test `src/ui/dialog.test.tsx`: `dialog named and closed by the platform` (`fireEvent(modal, 'requestClose')` calls `onClose` once; title is a level-2 heading), `footer keeps the order` (two `Button`s in a footer: same `flex`, order kept), `closed dialog shows nothing`.

### StatusMessage (`status-message.tsx`)

```ts
export function StatusMessage(props: { tone?: 'neutral' | 'success' | 'warning'; children: string }): JSX.Element
```
Mirrors `@shopperstop/ui` `StatusMessage`: a row, gap 8, padding 8 12, `radius.control`, `role="status"`, `accessibilityLiveRegion="polite"`; background `canvas` / `successSoft` / `warningSoft`; icon 16 `Info` `inkMuted` / `CircleCheck` `success` / `TriangleAlert` `warning`, hidden from assistive technology; text `body` `ink`. Not used by L2's screens; built for L4a and L3.
Test `src/ui/status-message.test.tsx`: `status message is a polite status`, `tones use tokens`.

### ImageTile (`image-tile.tsx`)

```ts
export function ImageTile(props: { uri?: string; size?: number; radius?: 'control' | 'card' }): JSX.Element
```
Square (`aspectRatio: 1`, `width: '100%'` unless `size` is given), `overflow: 'hidden'`, radius `control` by default, `surface`. With `uri`: `Image` `resizeMode="contain"`, `accessible={false}`, `importantForAccessibility="no-hide-descendants"`. Without: `canvas` fill with `ShoppingBasket` 20 `inkMuted`, `testID="image-placeholder"`.
Test `src/ui/image-tile.test.tsx`: `image from uri`, `placeholder without uri`.

### Changes to L1 primitives (task 5)

- `ErrorBanner`: the "Try again" pressable becomes `<Button variant="primary" size="md" onPress={onRetry}>Try again</Button>`; add the `CircleAlert` 20 `danger` icon the L1 design file names; styles to `StyleSheet`.
- `Skeleton({ count, variant = 'rows', columns = 2 })`: `rows` as today; `tiles`: a wrapping grid of `count` square blocks (`aspectRatio: 1`, `radius.card`, `line`), `columns` per row, gap 8; same "Loading" label.
- `FormField`: optional `tabular` adds `fontVariant: ['tabular-nums']` and `letterSpacing: 2` to the input (artboard 7); `address-sheet.tsx` passes `tabular` on Pincode.
- `EmptyState`: optional `level` (1 or 2, default 2) for the title heading.
- `Chip`, `Skeleton`, `ErrorBanner`: `StyleSheet.create`, `spacing.unit` multiples.

## 7 · Pincode sheet (`src/pincode-sheet.tsx`, mounted in `src/app/_layout.tsx`)

L1's `Sheet` titled "Where should we deliver?". Body gap 16:
1. `body` `inkMuted`: "Enter your pincode to see the store near you and what it has in stock."
2. `FormField` "Pincode", placeholder "6-digit pincode", `keyboardType="number-pad"`, `maxLength={6}`, `tabular`, `autoFocus`, `returnKeyType="go"` (`onSubmitEditing` continues when valid). `onChangeText` keeps digits only, first six. Hint "We currently deliver in parts of Bengaluru."; with six digits not matching `^[1-9][0-9]{5}$`, error "That is not a valid pincode.".
3. Signed in with saved addresses (`useAddresses()` from `src/addresses.ts`): a wrapping row, gap 8, of `Chip`s "<label> · <pincode>", selected when the field holds that pincode; pressing sets the field.
4. Primary `Button` `lg` "Continue", disabled until valid, `loading` while resolving.
5. Signed out: centred link (`accessibilityRole="link"`, min height 44, `body` 600 `accent`) "Have an account? Sign in to use a saved address" → closes the sheet and pushes `/sign-in?returnTo=%2F`.

The field starts from the stored pincode each time the sheet opens.

## 17 · Change pincode, clears cart (`Dialog` from `PincodeSheet`)

`Dialog` titled "Switch to the <new store name> store?", `onClose` = keep (ignored while clearing). Children, in order: a 48 circle `warningSoft` holding `ShoppingBag` 24 `ink` (hidden from assistive technology); `body` `inkMuted` "Pincode <pincode> is served by a different store. Your cart has <N> item(s) from <old store name>; switching will empty it." ("1 item", "N items"); when `clearCart()` returned an error, the alert "Could not empty your cart." (`dangerSoft`, radius control, padding 12, `accessibilityRole="alert"`); `DialogFooter` with `Button` secondary `lg` "Keep cart" then `Button` primary `lg` "Switch store" (`loading` while clearing; a ref guards a second press).

## 1 · Home (`src/app/(tabs)/index.tsx`)

Background `canvas`, a `ScrollView`.

Header (`brand`, below the top safe area, padding 16 16 12, gap 12):
- Row, space between, gap 12, `alignItems: 'center'`:
  - Column: the heading `Text` (`heading={1}`, `accessibilityLabel` "ShopperStop in <N> minutes" or "ShopperStop") holding the eyebrow "ShopperStop in" (`small` 700 `onBrand`, `textTransform: 'uppercase'`, `letterSpacing: 0.3`; just "ShopperStop" without an open store) and, with an open store, a new line "<N> minutes" (`display` `onBrand`). Then the pincode button: min height 44, row gap 4, "Delivering to <pincode>" (`body` 600 `onBrand`) and `ChevronDown` 16 `onBrand`; "Choose pincode" with no pincode; opens the sheet.
  - Account: 44 circle `surface` holding L1's `IconButton` "Account" (`User`), pushes `/account`.
- With an open store, the search field: a `Pressable` `accessibilityRole="button"` `accessibilityLabel="Search products"`, height 44, padding horizontal 12, radius control, `surface`, border 1 `lineStrong`, row gap 8: `Search` 20 `inkMuted`, `body` `inkMuted` text 'Search "milk"'. Pushes `/search`.

Body: `StoreGate` (below). For an open store:
- "Shop by category": `surface`, padding 16; `h2` level-2 heading, margin bottom 12; a grid of 4 per row, row gap 12, column gap 8: `CategoryTile` (link `accessibilityRole="link"`, column gap 6, centred: `ImageTile` radius card; name `small` 600 centred, 2 lines max) → `/category/<slug>`. Loading: `Skeleton variant="tiles" columns={4} count={8}`; failed: `ErrorBanner`.
- "Picked for you": margin top 8, `surface`, padding 16 0; heading row padding 0 16 12 (`h2`, level 2); horizontal `ScrollView` (`showsHorizontalScrollIndicator={false}`, content padding horizontal 16, gap 12) of `ProductCard` width 148. Loading: `Skeleton variant="tiles" columns={2} count={2}`; failed: `ErrorBanner`.
- Bottom padding 24 (the tab bar is the router's).

Document title "Home · ShopperStop" (unchanged).

## 18 · Loading (in `StoreGate`)

While the pincode is not yet known or the lookup has no answer: `Skeleton variant="tiles" columns={4} count={8}` inside `surface` padding 16. The header still shows (heading "ShopperStop").

## 8 · Not serviceable / closed (`src/serviceability-gate.tsx`)

```ts
export function StoreGate(props: { children: (store: Store) => ReactNode }): JSX.Element
```
Notice layout: `flex: 1`, centred column, `textAlign: 'center'`, padding 32 24, gap 16:
- 96 circle `warningSoft` with the icon 44 `ink` (`MapPinOff` for not serviceable and no pincode, `Clock` for closed), hidden from assistive technology.
- Title `h1` variant, `heading={2}`.
- Body `body` `inkMuted`, max width 300.
- Primary `Button` `lg` (margin top 8): "Change pincode" / "Choose pincode" → `openPincodeSheet()`.
- Closed only: link "See your orders" (`body` 600 `accent`, min height 44) → `/orders`.

| State | Title | Body | Button |
|---|---|---|---|
| no pincode | Set your pincode | Choose a pincode to see the store near you and what it has in stock. | Choose pincode |
| 404 `not_serviceable` | We don't deliver here yet | ShopperStop delivers in parts of Bengaluru for now. Try another pincode. | Change pincode |
| `isOpen` false | <name> store is closed | The store for your pincode isn't taking orders right now. Orders already placed will still arrive. | Change pincode + See your orders |
| other failure | `ErrorBanner` (padding 12) with `onRetry` = refetch | | |

## Categories tab (`src/app/(tabs)/categories.tsx`)

White header as now (height 64, `surface`, bottom border `line`, "Categories" `h2` level 1). Body `canvas` → `StoreGate` → `surface` padding 16, the same `CategoryGrid` as Home (4 per row) in a `ScrollView`.

## 2 · Category (`src/app/category/[slug].tsx`)

Background `surface`, column.
- Header (below the top safe area): height 64, padding horizontal 8, gap 4, bottom border 1 `line`: `IconButton` "Back" (`useBack`), the parent name (`h3`, heading level 1, flex 1, one line), `IconButton` "Search" → `/search`. While categories load the title is empty.
- Body row, flex 1:
  - Rail: `View` `role="tablist"` `accessibilityLabel="Subcategories"`, width 80, right border 1 `line`, a vertical `ScrollView`. Tabs: "All" (the parent) then each child: `Pressable` `role="tab"`, `aria-selected={selected}`, `accessibilityState={{ selected }}`, padding 10 4, centred column gap 4; `ImageTile` size 52 radius card; name `small` centred (600 when selected); selected background `accentSoft` with a 4 wide bar on the right edge (`accent`, top and bottom 8, left corners radius 4). Pressing → `router.setParams({ slug: <its slug> })`.
  - Products: flex 1, `canvas`, `ProductGrid` (padding 8, gap 8, two columns) with `categoryId` of the selected category.
- Unknown slug: `EmptyState` level 1 "Category not found" with a `Link` "Go to Home" (`body` 600 `accent`) to `/`.
- No product in the selected category: `EmptyState` "No products here yet".
- Document title "<parent name> · ShopperStop".

The canvas's filter chips ("In stock", "Price: low to high") are left out (design.md Contract audit 1).

## Product card (`src/catalog-card.tsx`)

```ts
export function ProductCard(props: { product: StoreProduct; storeId: string; width?: number }): JSX.Element
export function CategoryGrid(props: { categories: Category[] }): JSX.Element
```
Card: `surface`, border 1 `line`, radius card, padding 8, gap 4 (grid cards `flex: 1`; rail cards `width`).
- A `Link` (`href="/product/<slug>"`, `asChild`) around a `Pressable` `accessibilityRole="link"` `accessibilityLabel="<name> <unitLabel>"`, column gap 4: `ImageTile` (`uri` = `imageUri(product.imageUrl)`); while in stock a `Badge` (`neutral` "10+ left" when `quantity >= 10`, `warning` "Only N left" below); the name (`body` 600, `numberOfLines={2}`, min height 40); the unit (`small` `inkMuted`).
- A row, space between, centred, gap 4, margin top 4: `Price` (`layout="column"`, `mrpCents`) and the `Stepper` `md` with `label` = name, `max` = `inStock ? quantity : 0`, `value` = `useQuantity(product.id)`, `onChange` = `n => setQuantity(storeId, product.id, n)`.

## Paged grid (`src/catalog-grid.tsx`)

```ts
export function ProductGrid(props: {
  storeId: string
  filter: { categoryId?: string; q?: string }
  header?: ReactElement        // ListHeaderComponent (search's count heading)
  empty: ReactElement          // shown when the first page holds no products
}): JSX.Element
```
`FlatList` `numColumns={2}`, `columnWrapperStyle={{ gap: 8 }}`, content padding 8 and gap 8, `onEndReached` (threshold 0.5), `ListFooterComponent` = secondary `Button` md "Load more" (`loading` while fetching the next page) while `hasNextPage`. An odd last item keeps half width (render an empty `flex: 1` cell). States: no data and error → `ErrorBanner`; no data → `Skeleton variant="tiles" columns={2} count={6}`.

## 3 · Product (`src/app/product/[slug].tsx`)

Background `canvas`. A `ScrollView` with bottom padding for the bar (the bar's height plus 16), then the bar.
1. Image block: `surface`, padding 16 16 12 (top adds the safe area); `ImageTile` radius card full width. Over it, top 12 + safe area and left 28: a 44 circle `surface` with shadow `card` holding `IconButton` "Back".
2. Info block: `surface`, padding 4 16 16, gap 8: breadcrumb `small` `inkMuted` "Home / <parent> / <child>" (names found; "Home / <parent>" for a parent; "Home" when not found); name `h1` heading level 1; unit `body` `inkMuted`; a row gap 8 of badges: stock badge (as the card, "10+ left" or "Only N left", only in stock), `Badge` `success` "<N>% off" when `N = floor((mrp - price) * 100 / mrp) >= 1`.
3. "Product details": margin top 8, `surface`, padding 16, gap 12; `h3` heading level 2; a two-column wrap, gap 12, of pairs (label `small` `inkMuted`, value `body` 600): Unit; Category (the child's or parent's name, when found); Brand (when present); Description full width, value `body` 400 (when present).
4. "More in <category name>" (or "More in this category" when the name is not found): margin top 8, `surface`, padding 16 0; `h3` heading level 2, margin 0 16 12; horizontal `ScrollView` (padding horizontal 16, gap 12) of up to 10 items: a link (`accessibilityRole="link"`, `accessibilityLabel` "<name>"), width 120, column gap 4: `ImageTile` size 120 radius card, name `body` 600 (2 lines), price `body` 600 `accent` tabular. Pushes `/product/<slug>`. Hidden while empty or loading; a failure hides it too (secondary content).
5. Bottom bar: absolute bottom, `surface`, padding 12 16 (bottom 24 + safe area), shadow `sheet`, row gap 12: a column, flex 1: `Price size="lg" layout="row"` and "Inclusive of all taxes" (`small` `inkMuted`); the `Stepper` `lg`.

States: loading `Skeleton` (rows, 3); 404 → `EmptyState` level 1 "Product not found" + "Go to Home" link; other failure `ErrorBanner`. Document title "<name> · ShopperStop" ("Product · ShopperStop" while loading).

## 13 · Search (`src/app/search.tsx`)

Background `canvas`, column.
- Header (below the top safe area): `surface`, bottom border 1 `line`, padding 10 12 10 4, row gap 4: `IconButton` "Back"; the box: `View` `role="search"`, flex 1, height 44, row gap 8, padding 0 8 0 12, radius control, border 1 `accent`: `Search` 20 `inkMuted`; `TextInput` `accessibilityLabel="Search products"`, placeholder "Search products", 16/22 `ink`, `autoFocus`, `returnKeyType="search"`, `autoCapitalize="none"`, `autoCorrect={false}`, `onSubmitEditing` → `router.setParams({ q: text.trim() || undefined })`; while it holds text an `IconButton`-like 32 pressable "Clear search" (`X` 16 `inkMuted`, `hitSlop` to 44) that empties the box and focuses it. The box starts from `q`.
- Body: `StoreGate` →
  - `q` set: `ProductGrid` with `filter={{ q }}`; `header` = the heading `Text` level 1 (`body` `inkMuted`, margin 0 4 10) "<total> products for “<q>”" ("1 product for “<q>”"); `empty` = the no-results state.
  - No `q`: the "Search for products" state.
- Empty states: centred column, padding 48 16 24, gap 12: an 80 circle `surface` with `SearchX` 36 `ink` (hidden from assistive technology); `EmptyState`-style title `h2` heading level 1 ("No results for “<q>”" or "Search for products"); `body` `inkMuted` "Check the spelling, or browse a category instead." (no-results only; "Or browse a category." for no `q`); then a wrapping centred row, gap 8, padding 0 8, of links (`accessibilityRole="link"`, min height 44, padding horizontal 16, `radius.pill`, border 1 `lineStrong`, `surface`, `body` `ink`) to `/category/<slug>` for each parent of `useCategories`.
- Document title "Search · ShopperStop".

## Module interfaces

```ts
// src/pincode.ts
export const pincodeKey = 'shopperstop:pincode'
export function isPincode(value: string): boolean                 // /^[1-9][0-9]{5}$/
export function getPincode(): string | undefined
export function setPincode(next: string | undefined): void       // memory now (and loaded = true); AsyncStorage setItem / removeItem, rejections swallowed
export function usePincode(): { pincode?: string; loaded: boolean } // the first call starts the one read; a set before it settles wins
export function openPincodeSheet(): void
export function closePincodeSheet(): void
export function usePincodeSheetOpen(): boolean

// src/serviceability.ts
export type Store = components['schemas']['Store']
export type StoreState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'open'; store: Store; pincode: string }
  | { kind: 'closed'; store: Store; pincode: string }
  | { kind: 'notServiceable'; pincode: string }
  | { kind: 'error'; error: unknown; retry: () => void }
export function resolvePincode(pincode: string): Promise<{ store?: Store }>   // fetchQuery on ['serviceability', pincode]; rejects on failure
export function useStore(): StoreState

// src/cart.ts (stub; L3 replaces the bodies, keeps the names)
export function useQuantity(productId: string): number
export function setQuantity(storeId: string, productId: string, quantity: number): void
export function useCartSummary(): { count: number; storeId?: string }
export function getCartSummary(): { count: number; storeId?: string }
export function clearCart(): Promise<ApiError | undefined>

// src/catalog.ts
export type Category = components['schemas']['Category']
export type CategoryNode = components['schemas']['CategoryNode']
export type StoreProduct = components['schemas']['StoreProduct']
export const pageSize = 24
export function imageUri(path: string | undefined): string | undefined   // core origin + path
export function stockLabel(quantity: number): string | undefined        // '10+ left' | 'Only N left' | undefined at 0
export function findCategory(tree: CategoryNode[], slug: string): { parent: CategoryNode; selected: Category } | undefined
export function findCategoryById(tree: CategoryNode[], id: string): { parent: CategoryNode; selected: Category } | undefined
export function useCategories(storeId: string): UseQueryResult<CategoryNode[]>        // ['categories', storeId]
export function usePicks(storeId: string): UseQueryResult<StoreProduct[]>             // ['products', storeId, 'picks']: page 1, first 12 in stock
export function useProductPages(storeId: string, filter: { categoryId?: string; q?: string }): UseInfiniteQueryResult<InfiniteData<StoreProductList>>  // ['products', storeId, filter]
export function useProduct(storeId: string, slug: string): UseQueryResult<StoreProduct | null>  // ['product', storeId, slug]; 404 -> null
export function useMoreIn(storeId: string, product: StoreProduct): UseQueryResult<StoreProduct[]> // categoryId, pageSize 11, without the product, at most 10
```

Every query throws `error.error` (the `ApiError`) on failure, as L1's `useMe` does, so `ErrorBanner`'s `errorKind` works. Tests fake core with `fakeCore` from `src/fake-core.ts` (keys `"GET /stores/<id>/products"`; read `new URL(request.url).searchParams` for `page`, `q`, `categoryId`).

Test helpers: before rendering a screen that needs an open store, `setPincode('560034')` and fake `GET /serviceability` answering `{ store: { id, name: 'Koramangala', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 } }`. `jest.setup.ts` resets after each test: `setPincode(undefined)`, `closePincodeSheet()`, `await clearCart()`, async storage cleared.
