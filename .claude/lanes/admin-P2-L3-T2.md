# admin-P2-L3-T2 - categories page (task 2 of admin-catalog)
Status: done
## Doing
Task 2 landed (`test: categories page` c73ad98 red, then `feat: categories table, create, change and delete`). Awaiting team-lead / reviewer.
## Found
- Red run on this branch: `Tests  10 failed | 58 passed (68)`. Failing: "the categories table lists parents, each followed by its children", "no categories shows the empty state", "categories load failure shows a retry that reloads", "create a child category", "a change sends only the changed fields and reorders the tree", "a sort order the form cannot send is flagged without a request", "a validation error from core is shown on its field", "any other category save error shows a banner", "delete asks first, then removes the category", "a category in use cannot be deleted".
- Green run: `Tests  68 passed (68)`, 11 files. `make test-web` exit 0 (ui 54, admin 68, web 20 passed). `routeTree.gen.ts` unchanged. `openspec validate admin-catalog --type change --strict` valid.
- `src/categories.tsx` has no ImageUpload import or image line (task 4 adds them).
## Requests
## Blockers
