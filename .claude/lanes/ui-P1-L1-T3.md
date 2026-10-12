# ui-P1-L1-T3 - packages/ui task 3: Input, FormField, Select (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 3 done on lane/ui-P1-L1-t3-form-fields: test commit (red, 4 tests) then feat commit (Input, FormField, Select, tasks 3.1 and 3.2 ticked). All four gates green on Node 22.23.3. Waiting for review; no push.
## Found
- `Input` types its props as `ComponentPropsWithRef<'input'>` (design.md says `InputHTMLAttributes`) so `ref` is typed as a prop under React 19. Same for `Select` with `'select'`.
- `FormField`'s child type is `ReactElement<AriaAttributes & { id?: string }>`, not a bare `ReactElement`: `cloneElement` with `aria-describedby` does not typecheck against `Partial<{ id }>`.
- `FormField` reads the child's `id` from `children.props.id`; `useId()` is always called (hooks rule) and used only when the child has no id.
## Requests
## Blockers
