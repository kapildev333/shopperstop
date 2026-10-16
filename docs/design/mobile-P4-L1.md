# mobile-P4-L1 - screen and module data for `mobile-foundation-accounts`

Why this file exists: the workers cannot open the design canvas (D36), and the canvas copy the team lead read lives in a temporary folder. This file carries what the workers need from artboards 1 (tab bar only), 9, 10, 11, 12, 18 and 19, translated into token names and React Native terms, plus the module interfaces. The behaviour is in `openspec/changes/mobile-foundation-accounts/specs/mobile-app/spec.md`; the decisions are in that change's `design.md`. Where this file and the spec disagree, the spec wins; tell the team lead.

All sizes are density-independent pixels at a 390 wide screen. Colour names are the camelCase keys of `colors` from `@shopperstop/ui/tokens`, imported through `src/ui/tokens.ts`; never write a colour value. Type names are the scale in `src/ui/text.tsx` (`display` 28/34 700, `h1` 24/30 700, `h2` 20/26 700, `h3` 16/22 600, `body` 14/20 400, `small` 12/16 400, `button` 14/20 600). Radius: `radius.control` 8, `radius.card` 12, `radius.pill`. Shadows: `boxShadow: shadows.card.boxShadow` / `shadows.sheet.boxShadow` (React Native 0.88 draws `boxShadow` on iOS, Android and web; no `elevation`). Type: `type.<name>.size`, `.lineHeight`, `.weight`; the weight picks the family (400 `Inter_400Regular`, 600 `Inter_600SemiBold`, 700 `Inter_700Bold`).

## Shared pieces

| Piece | Data |
|---|---|
| Text input (in `FormField`) | height 48, padding horizontal 12, radius `control`, border 1 `lineStrong` (`danger` while it has an error), text 16/22 regular `ink` (16 stops iOS zooming), placeholder `inkMuted` |
| Field label | `body` weight 600 `ink`; an "(optional)" suffix in `body` 400 `inkMuted`; 6 between label, input and hint or error |
| Hint / field error | `small`; hint `inkMuted`; error `danger`, replaces the hint while shown |
| Primary button | height 48 (`lg`) or 44 (`md`), radius `control`, `accent` background, `onAccent` `button` text; pressed `accentHover`; disabled opacity 0.5; `loading` shows a 16 spinner (`ActivityIndicator`, colour `onAccent`) and disables |
| Secondary button | same frame, `surface` background, border 1 `lineStrong`, `ink` text |
| Danger button | secondary frame with `danger` text (the account's "Sign out") |
| Ghost / ghost-danger | no frame, `accent` / `danger` `button` text, min height 44, padding horizontal 8 (`compact`) |
| Icon button | 44 × 44 hit area, Lucide icon 20, colour `ink` unless the caller passes a tone; `accessibilityLabel` required |
| Alert (non-field error inside a form) | `dangerSoft` background, radius `control`, padding 12, `body` `ink`, `accessibilityRole="alert"` |
| Screen header (white) | height 64, padding horizontal 8, `surface`, bottom border 1 `line`, Back icon button (`ChevronLeft`) then the title in `h2` size as the level-1 heading, gap 4 |
| Card | `surface`, radius `card`, padding 16, shadow `card` |

Icons (Lucide, `lucide-react-native` 1.55.0): Back `ChevronLeft`, Close `X`, Account `User`, show/hide password `Eye` / `EyeOff`, Your orders `ReceiptText`, row chevron `ChevronRight` (16, `inkMuted`), Add `Plus` (16), alert `CircleAlert` (20, `danger`), tabs `House`, `LayoutGrid`, `ReceiptText`.

## Tab bar (artboard 1, bottom)

Expo Router `Tabs`, header hidden. Bar: height 72 plus the bottom safe area, `surface`, top border 1 `line`, three equal tabs. Each tab: icon 20 over the label in `small` (gap 2); the current tab `accent` with label weight 600, the others `inkMuted` weight 400. Order and labels: Home (`index`), Categories (`categories`), Orders (`orders`).

## Home (L1 placeholder; L2 replaces the body)

`brand` header, padding 16 16 12, below the top safe area; one row, space between: the level-1 heading "Groceries in minutes" (`display`, `onBrand`) and the icon button "Account" (`User`, 44 circle, `surface` background, `ink` icon) that pushes `/account`. Body: `canvas`, empty.

Categories and Orders tabs: the white screen header without the Back button, titled "Categories" / "Your orders", then `EmptyState` with the title "Nothing here yet".

## 9 · Sign in (`/sign-in`)

Background `surface`. Header `brand`, padding 8 8 32, `onBrand`: icon button "Back" (`ChevronLeft`, `onBrand`); then a block with padding 8 8 0 and gap 4: the level-1 heading "Sign in" (`display`) and the line "Sign in to place your order. Your cart stays as it is." (`body`).

Form: padding 24 16, gap 16, inside a `ScrollView` with `keyboardShouldPersistTaps="handled"`:
1. Alert (only for a non-field error).
2. Email: `FormField` label "Email", placeholder "you@example.com", `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`, `textContentType="emailAddress"`.
3. Password: `FormField` label "Password", `secureTextEntry` unless shown, `autoComplete="current-password"`; the trailing icon button "Show password" / "Hide password" (`Eye` / `EyeOff`, `inkMuted`) sits inside the input frame on the right.
4. Primary button `lg` "Sign in", margin top 8.
5. Centred `body` `inkMuted` line: "New to ShopperStop? " followed by the link "Create an account" (`accent`, weight 600, no underline) to `/register`, keeping `returnTo`.

## 10 · Register (`/register`)

As sign in, with: header padding 8 8 24; Back named "Back to sign in"; heading "Create account" (margin 8 8 0); no subtitle. Fields Name (`autoComplete="name"`), Email, Password (`autoComplete="new-password"`, hint "At least 8 characters."). Button "Create account". Footer "Already have an account? " and the link "Sign in" to `/sign-in`, keeping `returnTo`. The canvas also shows an optional Phone field; it is left out (design.md Decision 9: core's register takes no phone; the account's "Edit profile" sets it).

## 11 · Account (`/account`)

Background `canvas`. White screen header titled "My account". Content: `ScrollView`, padding 12 12 32, gap 12.

1. Profile card, a row with gap 12: initial avatar (52 circle, `brand` background, `onBrand` initial of the name, 20/26 700, hidden from assistive technology); a column with the name (`h3`), the email (`body` `inkMuted`), the phone when set (`body` `inkMuted`, tabular numbers); at the right a ghost compact button "Edit" whose accessible name is "Edit profile".
2. "Your orders" row: card radius `card`, padding horizontal 12, min height 56, shadow `card`, a row with gap 12: `ReceiptText` 20, the label (`body` 600, flex 1), `ChevronRight` 16. It is a link (`accessibilityRole="link"`) to `/orders`.
3. Saved addresses card (padding 16, gap 12): a header row, space between, holding "Saved addresses" (`h3`, a level-2 heading) and the ghost button "Add" with `Plus` 16, accessible name "Add address". Then one block per address: border 1 (`accent` on the default, `line` otherwise), radius `control`, padding 12, gap 6:
   - row, gap 8: the label (`body` 600) and, on the default, `Badge` `accent` "Default";
   - the lines `line1, line2, pincode` joined with ", " (`body` `inkMuted`);
   - actions row, gap 16: ghost "Edit", ghost "Set as default" (not on the default), ghost-danger "Delete". Accessible names "Edit <label>", "Set <label> as default", "Delete <label>".
   - With no addresses: `body` `inkMuted` "No saved addresses. Add one to check out faster."
4. Danger button `lg` "Sign out".

Loading and error (artboards 18, 19), per section: while `GET /me` holds nothing, the profile card shows `Skeleton` (one 64 block); while `GET /me/addresses` holds nothing, the addresses card shows `Skeleton` (two 64 blocks) under its header row. A failed read with nothing held shows `ErrorBanner` in that section's place.

## 12 · Add address / Edit address (sheet)

`Sheet` (below) titled "Add address" or "Edit address". Body gap 14:
1. "Save as": a `body` 600 label (margin bottom 8), then a row of `Chip`s with gap 8: Home, Work, Other, and the address's own label when it is none of these. New addresses start on Home. Chip: min height 44, padding horizontal 16, pill, border 1; selected: border `accent`, background `accentSoft`, text `accentHover`; otherwise border `lineStrong`, background `surface`, text `ink`. An envelope error on `label` shows under the row.
2. `FormField` "House, flat, floor" (`line1`, `autoComplete="address-line1"`).
3. `FormField` "Street and area" (`line2`, optional, `autoComplete="address-line2"`).
4. `FormField` "Pincode" (`keyboardType="number-pad"`, `maxLength={6}`, tabular numbers).
5. A row, min height 44, gap 10: React Native `Switch` with accessible name "Make this my default address" and the same text beside it; track colours from tokens (`accent` on, `lineStrong` off), thumb `surface`.
6. Alert for a non-field error, then the primary button `lg` "Save address".

The canvas's pincode error "Your cart is from the Koramangala store, which doesn't deliver to this pincode." belongs to checkout (L4), not here.

## Edit profile (sheet)

`Sheet` titled "Edit profile": `FormField` "Name" (`autoComplete="name"`), `FormField` "Phone" optional (`keyboardType="phone-pad"`, `autoComplete="tel"`, hint "The store sees it on your order so they can call about delivery."), alert for a non-field error, primary button `lg` "Save".

## Sheet

React Native `Modal` (`transparent`, `animationType="slide"`, `onRequestClose` = close, which covers the Android back gesture and Escape on the web export). Inside: a full-screen backdrop `Pressable` (accessible name "Close sheet", background `colors.ink` with `opacity: 0.5`) and, at the bottom, the panel: `surface`, top corners radius `card`, shadow `sheet`, padding 8 16 28 plus the bottom safe area, a `KeyboardAvoidingView` (`behavior="padding"` on iOS) around the content. Header row, space between: the title (`h2`, heading) and the icon button "Close" (`X`). The panel holds `accessibilityViewIsModal` so VoiceOver stays inside.

## 18 · Loading and 19 · Error

`Skeleton`: a column (gap 12) of `count` blocks, each height 64, radius `card`, background `line`; the column is `accessible` with the label "Loading"; the blocks are hidden from assistive technology. No pulse animation (design.md Decision 6).

`ErrorBanner({ error, onRetry })`: a block with `accessibilityRole="alert"`, `dangerSoft` background, radius `control`, padding 12, a row with gap 10: `CircleAlert` 20 `danger`, then a column with the title (`body` 600) and the body (`body`):
- `errorKind(error) === 'offline'` (the read threw, core never answered): "You're offline" / "Check your connection and try again."
- `'server'` (core answered a failure, the error has a string `code`): "Something went wrong on our side" / "Please try again in a moment."

Below it, margin top 8, the primary button "Try again" calling `onRetry`. The canvas's 88 px illustration is left out (design.md Decision 6).

`EmptyState({ title, description?, icon?, action? })`: centred column, gap 8, padding 24: optional Lucide icon 20 `inkMuted`, the title (`h2`, heading), the description (`body` `inkMuted`), the action.

## Module interfaces

```ts
// src/session.ts
export const tokenKey = 'shopperstop.customer-token'
export function getToken(): string | undefined
export function setToken(next: string | undefined): void   // memory + secure store (localStorage on web)
export function useToken(): string | undefined            // useSyncExternalStore, server snapshot undefined

// src/api.ts
export type ApiError = components['schemas']['Error']['error']
export const unreachable: ApiError  // { code: 'internal', message: 'Could not reach ShopperStop. Try again.' }
export const coreUrl: string        // `${process.env.EXPO_PUBLIC_CORE_URL ?? 'http://localhost:8080'}/api/core/v1`
export const authMiddleware: Middleware
export const api: Client<paths>     // createClient({ baseUrl: coreUrl, fetch: (r) => globalThis.fetch(r) }) + authMiddleware
export const queryClient: QueryClient  // retry: false
export function call(request: () => Promise<{ error?: { error: ApiError } }>): Promise<ApiError | undefined>
export function splitError(error: ApiError | undefined, fields: readonly string[]): { fields: Record<string, string>; banner?: string }
export function useMe(): UseQueryResult<Customer>  // key ['me', token], enabled while a token is held, throws error.error

// src/auth.ts
export function safeReturnTo(raw: unknown): string
export function signIn(body: { email: string; password: string }): Promise<ApiError | undefined>
export function register(body: { name: string; email: string; password: string }): Promise<ApiError | undefined>
export function signOut(): Promise<void>  // POST /auth/sign-out (result ignored), setToken(undefined), queryClient.clear()

// src/addresses.ts
export type Address = components['schemas']['Address']
export type AddressValues = { label: string; line1: string; line2: string; pincode: string; isDefault: boolean }
export function useAddresses(): UseQueryResult<Address[]>  // key ['addresses', token], first page only, throws error.error
export function saveAddress(id: string | undefined, values: AddressValues): Promise<ApiError | undefined>  // POST or PATCH, line2 '' omitted on POST, sent as '' on PATCH (clears it); invalidates ['addresses']
export function setDefaultAddress(id: string): Promise<ApiError | undefined>
export function deleteAddress(id: string): Promise<ApiError | undefined>

// src/ui/error-banner.tsx
export function errorKind(error: unknown): 'offline' | 'server'
```

The pattern every read view follows (from web-P2-L6; no shared helper):

```tsx
const me = useMe()
if (me.data === undefined) return me.isError ? <ErrorBanner error={me.error} onRetry={() => me.refetch()} /> : <Skeleton count={1} />
return <ProfileCard customer={me.data} />
```
