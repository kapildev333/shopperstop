## Context
Nine queued requests from web and admin (PLAN.md D34, `.claude/areas/ui.md`). Every piece is a few lines in one file of `packages/ui/src/`; the only shared logic is `use-modal.ts`, which today registers one `document` keydown listener per open modal, so two open modals both close on one Escape and fight over Tab. No new dependency, no token change. `docs/design/ui-P3-L1.md` is not needed: this file fixes every interface.

## Decisions

### 1. `ImageTile` (`image-tile.tsx`, new)
```tsx
export type ImageTileProps = { src?: string; alt: string; className?: string }
```
- Outer `div`: `cn('aspect-square shrink-0 overflow-hidden rounded-control bg-surface', className)`. No width and no border: the caller sets the width (`w-full` in web's card, `w-10` in admin's table, `w-32` on admin's upload) and adds `border border-line` if it wants one. `cn` does not dedupe Tailwind classes, so a default width would fight the caller's.
- With `src`: `<img src={src} alt={alt} loading="lazy" className="size-full object-contain" />`.
- Without `src`: `<div data-placeholder className="flex size-full items-center justify-center bg-canvas"><ShoppingBasket size={20} aria-hidden className="text-ink-muted" /></div>`. `ShoppingBasket` is the icon web already draws in its tile. No accessible name: there is no image to describe; the page says "no image" in text if it matters.
- Decorative = `alt=""`, the HTML convention, instead of a second `decorative` prop. `alt` is required at the type level, so omitting it is a compile error and an empty string is a visible, deliberate choice.

### 2. `aria-disabled` on `Button` and `ButtonLink` (`button.tsx`)
- Append `aria-disabled:cursor-not-allowed aria-disabled:opacity-50` to `base` (Tailwind 4's `aria-disabled:` matches `[aria-disabled="true"]`). `ButtonLink` and every `buttonClass` caller get it for free.
- Styling only. The button keeps its `onClick` and form submission; the caller's handler ignores presses while unavailable (admin's handlers already do). Ceiling: a caller that forgets the guard acts on a press; add a click guard in `Button` if that is ever reported.

### 3. `Button` `size="compact"` (`button.tsx`)
- `ButtonSize = 'md' | 'lg' | 'compact'`; `compact: 'h-11 px-2 sm:h-8'`.
- How it squares with the 44 px phone rule: below `sm` compact is as tall as `md` (44 px); it saves only side padding (8 px instead of 16 px), which is what lets an order number sit flush in a card row or table cell. From `sm` up (pointer layouts, outside the phone rule) it is 32 px, above WCAG 2.5.8's 24 px minimum. Use it with `variant="ghost"` for an order number.

### 4. `ChoiceGroup` and `Choice` (`choice-group.tsx`, new; `chip.tsx`)
```tsx
export function ChoiceGroup(props: { label: string; value?: string; onChange: (value: string) => void; children: ReactNode; className?: string })
export function Choice(props: { value: string; children: ReactNode; className?: string })
```
- Compound, not an `options` array: web's checkout puts each choice in its own address row (`<li>` with the label, lines and pincode), so the choices must be placeable anywhere inside the group. The rider app wraps them in a flex row.
- `ChoiceGroup` renders `<div role="radiogroup" aria-label={label} className={className}>` and provides `{ value, onChange }` through a React context (`createContext`, read with `use`). `Choice` outside a group throws `Error('Choice must be inside a ChoiceGroup')`.
- `Choice` renders `<button type="button" role="radio" aria-checked={checked} tabIndex={checked || value === undefined ? 0 : -1} onClick={() => onChange(choiceValue)} onKeyDown={...} className={cn(chipClass(checked), className)}>`. Space and Enter are the button's own click.
- Arrow keys, handled on the `Choice` (an interactive element, so jsx-a11y stays quiet): ArrowRight/ArrowDown = +1, ArrowLeft/ArrowUp = -1. Find `radios = event.currentTarget.closest('[role="radiogroup"]')!.querySelectorAll<HTMLButtonElement>('[role="radio"]')` in document order, take the next index with wrap-around, `preventDefault()`, then `next.focus()` and `next.click()` (the click runs that choice's `onChange`). No Home/End (not required by the WAI-ARIA radio pattern).
- `chip.tsx` gains `export function chipClass(selected: boolean): string` returning the current pill classes (`h-11 rounded-full border px-4 text-body transition-colors sm:h-9` plus the selected or unselected pair); `Chip` calls it. Chip's behaviour and test are unchanged.
- The group `value` must be `undefined` or one of its choices' values. Ceiling: with a value that matches no choice, nothing is a tab stop; when a caller needs that state, the group tracks its choice values.

### 5. `VisuallyHidden` (`visually-hidden.tsx`, new)
```tsx
export function VisuallyHidden({ live, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { live?: boolean }) {
  return <span aria-live={live ? 'polite' : undefined} {...rest} className={cn('sr-only', className)} />
}
```
- A `span`, so it fits inside a button or a paragraph; `sr-only` positions it absolutely, so it also works as a standalone live region. Attributes pass through (admin keeps `role="status"` and `aria-label="New orders"` on its region).
- A live region must be mounted before its text changes: render it always and change its children. Said in a comment on the component.

### 6. Stacking `Dialog` and `Sheet` (`use-modal.ts`)
- A module-level `const layers: HTMLElement[] = []`. The open effect pushes the panel; the cleanup removes it (`layers.splice(layers.indexOf(panel), 1)`) before restoring focus. `onKeyDown` returns at once unless `layers[layers.length - 1] === panel`. Each layer already stores its own `previous` (the opener) and refocuses it on close, so focus returns to the Sheet's button when the Dialog closes and to the page button when the Sheet closes.
- An Escape is handled once: the top layer's `onClose` only schedules a render, so the top stays last in `layers` while the lower layer's listener runs and returns.
- Same `z-50`: a later portal is later in `body`, so it paints on top. No z-index bookkeeping.
- Ceiling: layers must open one after another (a user action opens the upper one). Opened in the same commit, React runs the inner effect first and the outer layer would count as the top. Track open order by an explicit counter if that case appears.

### 7. `Table` `stack` label above the value (`table.tsx`)
- The in-cell label `span` becomes `block text-small font-semibold text-ink-muted sm:hidden`: on phone it is a line of its own above the value; from `sm` up `sm:hidden` still wins (variants sort after base utilities). The text content stays "Email" then the value; layout, not a separator character, does the separating. No `gap` needed.

### 8. `IconButton` `type` (`icon-button.tsx`)
- Move `type="button"` before `{...rest}`: `<button type="button" {...rest} className=...>`. `type` is already in `IconButtonProps` through `ButtonHTMLAttributes`; only the order changes.

### 9. `TabNav` reveals the current link (`tab-nav.tsx`)
- `const ref = useRef<HTMLElement>(null)` on the `nav`; `useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) }, [])`.
- `scrollIntoView?.(...)`: jsdom has no `scrollIntoView` (measured), and both apps render `TabNav` in their jsdom tests; the optional call keeps those green. The ui test stubs `Element.prototype.scrollIntoView` with `vi.fn()` and restores it.
- Mount only. On a client-side navigation the clicked link is already in view; keyboard focus scrolls natively. Ceiling: a programmatic navigation to an off-screen tab does not scroll it; add the current link's `href` as a dependency then. Ceiling: a TabNav mounted below the fold would also scroll the page to it (`block: 'nearest'`); both apps mount it at the top; set the nav's `scrollLeft` instead if that changes.

### Exports (`index.ts`)
Three new lines, each added by the task that creates the file, at three separated anchors so parallel tasks never edit neighbouring lines:
- `export * from './choice-group' // ChoiceGroup, Choice` after the `./stepper` line (task 5),
- `export * from './image-tile'` after the `./table` line (task 4),
- `export * from './visually-hidden'` after the `./error-banner` line, at the end (task 4).
Each new component's tests import it from `./index`, which is what proves the export.

### Tests
Testing Library and user-event in jsdom, as the package already does; one test per scenario, named after it (lower case), inside a `describe` named after the requirement where the file already uses that style. Layout cannot be measured in jsdom, so layout scenarios pin classes (as the existing Table and TabNav tests do); the manager's Chrome walk checks the real layout.

## Simplifications and ceilings (summary)
- `alt=""` is the decorative switch, no `decorative` prop.
- `aria-disabled` is styling only; handlers guard themselves.
- `compact` keeps 44 px on phone; only padding shrinks there.
- `ChoiceGroup` value must be undefined or a choice's value; no disabled choices, no Home/End.
- Stacked modals must open one after another.
- `TabNav` scrolls into view on mount only.
- `ImageTile` has no load-error fallback (a broken URL shows the browser's broken image); add `onError` to the placeholder when core serves stale URLs.

## Files
All in area ui: `packages/ui/src/` `button.tsx`, `button.test.tsx`, `icon-button.tsx`, `icon-button.test.tsx`, `table.tsx`, `table.test.tsx`, `tab-nav.tsx`, `tab-nav.test.tsx`, `use-modal.ts`, `dialog.test.tsx`, `image-tile.tsx`, `image-tile.test.tsx`, `visually-hidden.tsx`, `visually-hidden.test.tsx`, `choice-group.tsx`, `choice-group.test.tsx`, `chip.tsx`, `index.ts`. Plus this change's `tasks.md` checkboxes.

## Figma (orchestrator draws; the lane does not wait)
On `Tokens & Components`: `ImageTile` (image and placeholder variants, 1:1, `control` radius); `Choice` pill (checked, unchecked, focus) inside a `ChoiceGroup` frame; `Button` `size=compact` (ghost, phone 44 px and desktop 32 px) and an "unavailable (aria-disabled)" state matching disabled; `Table` stacked row at phone width with the label above the value; a note on `Dialog`/`Sheet` that a Dialog may open on top of a Sheet. `VisuallyHidden`, `IconButton type` and the `TabNav` scroll have no visual.
