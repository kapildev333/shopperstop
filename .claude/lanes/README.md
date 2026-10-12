# Lane logs

One file per lane, named by its LANE-ID from the brief: `lanes/<LANE-ID>.md`, where `LANE-ID = <area>-P<phase>-L<n>` (for example `core-P1-L3`). The lane that owns the file is the only one that writes it.

```markdown
# <LANE-ID> - <deliverable>
Status: started | blocked | done
## Doing
<current step, one line, keep it current>
## Found
<things other lanes, the area manager or the orchestrator need to know: changed interfaces, gotchas>
## Requests
- to <LANE-ID or area>: <what you need from them>
## Blockers
```

- Read every other lane's file when you start and before you finish; answer requests addressed to you in your own `Found` section.
- The area manager reads its area's lane files, relays urgent requests, and folds anything durable into `.claude/areas/<area>.md`. A request to another area goes through the area plan's `## Requests`; the orchestrator relays it. PLAN.md is orchestrator-only.
