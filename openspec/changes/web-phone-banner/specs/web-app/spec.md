## ADDED Requirements

### Requirement: Customer banner on a phone
On a viewport narrower than 640 px the banner's account link SHALL show its icon without visible text, and its accessible name SHALL stay the customer's name ("Account" while it loads). The pincode control's "Delivery in N minutes" line SHALL stay on one line, with the pincode on the line below starting at the same left edge. No banner control SHALL extend past the viewport. At 640 px and wider the account link SHALL show the customer's name.

#### Scenario: Signed-in banner on a phone
- **WHEN** a customer named "Walk Customer" is signed in, `560034` is stored, and `/` is shown at 390 by 844 px
- **THEN** the banner holds a link named "Walk Customer" pointing to `/account` whose box is at least 44 px tall and at most 56 px wide, the name's text box is at most 1 px wide, "Delivery in 10 minutes" is one line (its box at most 24 px tall), "560034" starts within 0.5 px of the promise's left edge, no banner link, button or search box ends past 390 px, the page does not scroll horizontally, and axe reports no violations

#### Scenario: Signed-in banner on desktop
- **WHEN** the same customer is signed in and `/` is shown at 1024 by 768 px
- **THEN** the banner's "Walk Customer" link shows the name: the name's text box is at least 20 px wide

### Requirement: Pincode sheet focus
When the pincode sheet opens, focus SHALL move to its Pincode field. When it closes, focus SHALL return to the control that had it before the sheet opened.

#### Scenario: First visit focuses the pincode field
- **WHEN** the app renders `/` with no pincode stored
- **THEN** the "Your delivery pincode" dialog is open and its Pincode field has focus

#### Scenario: Banner control focuses the pincode field
- **WHEN** `560034` is stored, the app renders `/`, the banner's pincode control is chosen, and then Escape is pressed
- **THEN** while the dialog is open its Pincode field has focus, and after Escape the dialog is closed and the banner's "Delivery in 10 minutes 560034" button has focus
