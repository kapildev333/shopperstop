# Area plans

One file per area, `areas/<area>.md`, written by the orchestrator (the work package) and then kept current by that area's manager only.

```markdown
# <area> - <one-line scope>
Scope: <paths>
Depends on: <area or none> (<what exactly>)
Spec: <spec file §sections>; plan tasks <numbers>
## Doing
<which lane is running, whether make e2e is running>
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
## Requests
- to <area>: <what you need, which file carries the contract>
## Found
<for the orchestrator: decisions to record, risks, deviations>
## Backlog
```
