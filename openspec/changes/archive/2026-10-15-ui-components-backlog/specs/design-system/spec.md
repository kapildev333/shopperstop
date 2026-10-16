## MODIFIED Requirements

### Requirement: Shared components
`packages/ui` SHALL export Button, ButtonLink, IconButton, Input, FormField, Select, Stepper, Badge, Chip, ChoiceGroup, Choice, Card, ImageTile, Dialog, Sheet, Table, EmptyState, ErrorBanner, StatusMessage, VisuallyHidden, Skeleton, PageHeader, TabNav, Price, `formatInr` and `cn`, each with a test, and the apps SHALL compose pages from them rather than define one-off recipes.

#### Scenario: Stepper at zero stock
- **WHEN** a Stepper renders with `max` 0
- **THEN** it shows a disabled control labelled "Out of stock" and never calls `onChange`

#### Scenario: Stepper at the maximum
- **WHEN** a Stepper renders with `value` equal to `max`
- **THEN** the increment control is disabled and the decrement control is enabled

#### Scenario: Price formatting
- **WHEN** `formatInr` receives 123400, 123450 and 12345600
- **THEN** it returns `₹1,234`, `₹1,234.50` and `₹1,23,456`

### Requirement: Button variants and loading
`Button` SHALL render a native button of type `button` unless told otherwise, with variants `primary`, `secondary`, `ghost`, `ghost-danger` and sizes `md` (44 px on phone, 40 px from `sm`), `lg` (48 px) and `compact` (44 px on phone, 32 px from `sm`, 8 px side padding); `loading` SHALL disable it, set `aria-busy`, show an `aria-hidden` spinner and keep the label.

#### Scenario: Default type is button
- **WHEN** a Button without `type` is clicked inside a form
- **THEN** the form is not submitted

#### Scenario: Loading blocks clicks
- **WHEN** a Button renders with `loading`
- **THEN** it is disabled, has `aria-busy="true"`, still shows its label, and clicking it does not call `onClick`

#### Scenario: Primary uses the accent
- **WHEN** a Button renders with no variant
- **THEN** it has the classes `bg-accent` and `text-on-accent`

#### Scenario: Compact size keeps the phone tap target
- **WHEN** a Button and a ButtonLink render with `size="compact"`
- **THEN** each has the classes `h-11`, `sm:h-8` and `px-2`, and neither has `sm:h-10` or `px-4`

### Requirement: IconButton has an accessible name
`IconButton` SHALL require an `aria-label` at the type level, render it as the button's accessible name, and render its icon `aria-hidden` at 20 px, with a 44 px target on phone; it SHALL be of type `button` unless the caller passes `type`.

#### Scenario: Name comes from aria-label
- **WHEN** an IconButton renders with `aria-label="Close"`
- **THEN** a button named "Close" exists and its svg is `aria-hidden`

#### Scenario: Missing label does not compile
- **WHEN** an IconButton is written without `aria-label`
- **THEN** `tsc` reports an error (pinned with `@ts-expect-error` in the test)

#### Scenario: IconButton submits when asked
- **WHEN** an IconButton with `type="submit"` and one without `type` are clicked inside a form
- **THEN** the form is submitted once, by the first

### Requirement: Modal focus management
`Dialog` and `Sheet` SHALL render a modal dialog named by its title, move focus inside on open, keep Tab and Shift+Tab inside, call `onClose` on Escape, and return focus to the previously focused element after closing. When one modal opens while another is open, only the most recently opened one SHALL handle Escape and Tab.

#### Scenario: Focus is trapped
- **WHEN** a Dialog with two buttons is open and the user tabs past the last button
- **THEN** focus moves to the first button, and Shift+Tab from the first moves to the last

#### Scenario: Focus returns on close
- **WHEN** a Dialog opened from a button is closed
- **THEN** that button has focus again

#### Scenario: Sheet closes on Escape and on its close button
- **WHEN** a Sheet titled "Cart" is open and the user presses Escape or clicks "Close"
- **THEN** `onClose` is called, and the dialog is named "Cart"

#### Scenario: Stacked modals close top first
- **WHEN** a Sheet is opened from a page button, a Dialog is opened from a button inside the Sheet, and the user presses Escape twice
- **THEN** the first Escape closes only the Dialog and focus returns to the Sheet's button, and the second closes the Sheet and focus returns to the page button

#### Scenario: Tab stays in the top modal
- **WHEN** a Dialog with two buttons is open on top of an open Sheet and the user tabs past the Dialog's last button
- **THEN** focus moves to the Dialog's first button, never into the Sheet

### Requirement: Table stack mode
`Table` SHALL render rows from `columns` and `rows` as a native table with header cells; with `stack` it SHALL also render each column header inside its cell for phone layouts, on its own line above the value, hidden from `sm` up.

#### Scenario: Rows and headers render
- **WHEN** a Table renders two rows and the columns "Product" and "Quantity"
- **THEN** there are two column headers and two body rows with the cell content

#### Scenario: Stack labels cells
- **WHEN** the same Table renders with `stack`
- **THEN** each body cell contains its column header text, and without `stack` it does not

#### Scenario: Stack label sits above the value
- **WHEN** a Table renders with `stack`
- **THEN** each in-cell label is the cell's first child and has the classes `block` and `sm:hidden`

### Requirement: Page header and tab navigation
`PageHeader` SHALL render the page title as the only level-1 heading with optional description and actions; `TabNav` SHALL render a navigation landmark named by `label` around its links, style the link with `aria-current="page"` as current, SHALL scroll horizontally without wrapping when its links exceed the width, and SHALL scroll the current link into view when it mounts.

#### Scenario: Page header
- **WHEN** a PageHeader renders with title "Orders" and an action
- **THEN** there is one level-1 heading "Orders" and the action

#### Scenario: Tab navigation landmark
- **WHEN** a TabNav labelled "Order views" wraps two links, one with `aria-current="page"`
- **THEN** a navigation landmark named "Order views" holds both links and the current one keeps `aria-current="page"`

#### Scenario: Tab navigation scrolls instead of wrapping
- **WHEN** a TabNav renders seven links in a narrow container
- **THEN** the nav has horizontal overflow scrolling, the links do not wrap or shrink, and the current-link styling and the landmark are unchanged

#### Scenario: Tab navigation reveals the current link
- **WHEN** a TabNav mounts with seven links, the last one with `aria-current="page"`
- **THEN** `scrollIntoView` is called once, on that link, with `{ block: "nearest", inline: "nearest" }`

## ADDED Requirements

### Requirement: Image tile
`ImageTile`, exported from the package entry, SHALL render a square tile with the `control` radius showing `src` scaled to fit with the required `alt` (an empty `alt` marks it decorative), lazily loaded; without `src` it SHALL show a `canvas` placeholder with an `aria-hidden` Lucide icon and expose nothing to assistive technology.

#### Scenario: Tile shows the image
- **WHEN** an ImageTile renders with `src="/img/milk.png"` and `alt="Milk"`
- **THEN** an image named "Milk" with that `src` and `loading="lazy"` is inside an element with `aspect-square` and `rounded-control`

#### Scenario: Placeholder without an image
- **WHEN** an ImageTile renders without `src` and with `alt="Milk"`
- **THEN** no `img` role is exposed, and the tile holds a `bg-canvas` element with an `aria-hidden` svg

#### Scenario: Decorative tile
- **WHEN** an ImageTile renders with `src` and `alt=""`
- **THEN** its image has an empty `alt` and the `presentation` role

#### Scenario: Missing alt does not compile
- **WHEN** an ImageTile is written without `alt`
- **THEN** `tsc` reports an error (pinned with `@ts-expect-error` in the test)

### Requirement: Single-choice group
`ChoiceGroup`, exported with `Choice` from the package entry, SHALL render a `radiogroup` named by `label` whose `Choice` descendants are pill `radio` buttons styled like a `Chip`, checked when their `value` equals the group's `value`; clicking a choice, or an arrow key moving to it, SHALL call `onChange` with its value. Only the checked choice SHALL be a tab stop, or every choice when none is checked.

#### Scenario: Click chooses
- **WHEN** a ChoiceGroup labelled "Deliver to" with value "home" holds choices "home" and "work", and the user clicks "work"
- **THEN** a `radiogroup` named "Deliver to" holds two radios, "home" is checked, and `onChange` is called with "work"

#### Scenario: Arrow keys move and choose
- **WHEN** focus is on the last of three choices in a ChoiceGroup and the user presses ArrowRight, then ArrowLeft
- **THEN** ArrowRight focuses the first choice and calls `onChange` with its value (wrapping), and ArrowLeft focuses the last choice and calls `onChange` with its value; ArrowDown and ArrowUp act like ArrowRight and ArrowLeft

#### Scenario: One tab stop
- **WHEN** a ChoiceGroup with value "work" holds three choices, and another with no value holds two
- **THEN** in the first only "work" has `tabindex="0"` and the others `-1`, and in the second both have `tabindex="0"`

#### Scenario: Choices can sit anywhere inside the group
- **WHEN** each Choice of a ChoiceGroup is inside its own list item
- **THEN** the arrow keys move between them in document order

### Requirement: Visually hidden text and live region
`VisuallyHidden`, exported from the package entry, SHALL render its children with the `sr-only` class and pass other attributes through; with `live` it SHALL be an `aria-live="polite"` region.

#### Scenario: Hidden text names a control
- **WHEN** a button holds an `aria-hidden` icon and a VisuallyHidden "Close"
- **THEN** the button is named "Close" and the VisuallyHidden element has the class `sr-only`

#### Scenario: Live variant is polite
- **WHEN** a VisuallyHidden renders with `live` and "3 new orders"
- **THEN** its element has `aria-live="polite"`, the class `sr-only`, and the text; without `live` it has no `aria-live`

### Requirement: Unavailable buttons stay focusable
`Button` and `ButtonLink` with `aria-disabled="true"` SHALL look like a disabled Button (`opacity-50`, `cursor-not-allowed`) while staying in the tab order; the caller's handler decides what a press does.

#### Scenario: aria-disabled looks disabled and keeps focus
- **WHEN** a Button and a ButtonLink render with `aria-disabled="true"` and the user tabs
- **THEN** each has the classes `aria-disabled:opacity-50` and `aria-disabled:cursor-not-allowed`, the Button has no `disabled` attribute, and each receives focus in turn
