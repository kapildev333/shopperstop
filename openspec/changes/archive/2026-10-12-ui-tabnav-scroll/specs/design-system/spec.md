## MODIFIED Requirements

### Requirement: Page header and tab navigation
`PageHeader` SHALL render the page title as the only level-1 heading with optional description and actions; `TabNav` SHALL render a navigation landmark named by `label` around its links, style the link with `aria-current="page"` as current, and SHALL scroll horizontally without wrapping when its links exceed the width.

#### Scenario: Page header
- **WHEN** a PageHeader renders with title "Orders" and an action
- **THEN** there is one level-1 heading "Orders" and the action

#### Scenario: Tab navigation landmark
- **WHEN** a TabNav labelled "Order views" wraps two links, one with `aria-current="page"`
- **THEN** a navigation landmark named "Order views" holds both links and the current one keeps `aria-current="page"`

#### Scenario: Tab navigation scrolls instead of wrapping
- **WHEN** a TabNav renders seven links in a narrow container
- **THEN** the nav has horizontal overflow scrolling, the links do not wrap or shrink, and the current-link styling and the landmark are unchanged
