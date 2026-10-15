// For a button that cannot act now but must stay focusable: `disabled` would drop keyboard focus from the button just
// pressed. Use with `aria-disabled` and a handler that does nothing meanwhile.
// ponytail: an app-level class until ui's Button styles `aria-disabled` itself (asked of ui by admin-P2-L4).
export const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
