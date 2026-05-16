\# Direct Manipulation Segment Editing Goal



Current base commit:

60f29e7e970c0ab47259c9de2e01061f730bb4aa

"Show child activity composer directly in popover"



\## Product goal



Implement the Plan-only Direct Manipulation Segment Editing System for TiTi.



The planner should feel like a direct manipulation canvas:

\- users can resize real activity segments

\- empty time is always shown as virtual "휴식" gaps

\- users can click a 휴식 gap and fill it from the existing activity chip board

\- users can edit, move, split, merge, delete, duplicate, and row-swap plan segments without relying on separate forms



\## Confirmed design



1\. Empty time is rendered as always-visible virtual "휴식" gaps.

2\. 휴식 gaps are not saved as real activity data.

3\. 휴식 gaps are calculated from empty time between real plan segments.

4\. Render only gaps of 10 minutes or more.

5\. Clicking a 휴식 gap opens the existing inline plan dropdown / activity chip board.

6\. Choosing an activity fills the entire clicked 휴식 gap.

7\. Activity default duration must not override the clicked gap duration.

8\. Parent activity selection fills the gap with the parent activity.

9\. Child activity selection uses the existing title/activity split:

&#x20;  - parent → titleText / titleActivityId

&#x20;  - child → activityText / activityId

10\. Deleting a real segment returns that time to a calculated 휴식 gap.

11\. 휴식 gaps must look weaker than real activity segments.

12\. 휴식 gaps must not show timer controls, resize handles, or toolbar.

13\. 휴식 gaps must never be persisted to local storage or saved plan data.



\## Hard constraints



\- Plan-only only.

\- Do not redesign actual-record mode.

\- Do not remove the existing dropdown or activity chip board.

\- Reuse the existing activity chip board for filling 휴식 gaps.

\- Do not regress the child activity popover.

\- Do not regress the directly visible child activity composer.

\- Do not change the timer data model unless strictly necessary.

\- Do not save virtual 휴식 gaps as real activities.

\- Do not push to main automatically.

\- Preserve existing tests.

\- Add regression tests for every new interaction state.

\- Run npm test after each major phase.

\- Keep each phase reviewable.



\## Interaction priority



1\. timer icon

2\. resize handle

3\. row drag handle

4\. toolbar / menu

5\. activity title inline edit

6\. time display inert area

7\. 휴식 gap click

8\. segment background drag



Segment background drag must not start from:

\- timer icon

\- activity title text

\- time display

\- resize handles

\- context toolbar

\- row drag handle

\- activity chip board

\- child activity popover

\- 휴식 gap



\## Phase 0 — Recon



Before editing:

\- confirm current HEAD

\- inspect plan-only rendering

\- inspect planActivities data shape

\- inspect inline plan dropdown target model

\- identify where virtual 휴식 gaps should be calculated

\- identify how a 휴식 gap can become a dropdown target

\- summarize files to change



\## Phase 1 — Helpers and virtual gap model



Implement pure helpers:

\- snapToTenMinutes

\- normalizePlanSegmentRange

\- calculateVirtualRestGaps

\- mergeAdjacentGaps

\- findOverlaps

\- createSegmentId if needed



Tests:

\- gap between segments

\- leading/trailing gap in a slot

\- gap under 10 minutes is ignored

\- adjacent gaps merge

\- virtual gaps are not persisted



\## Phase 2 — Render always-visible 휴식 gaps



Behavior:

\- render real activity segments and virtual 휴식 gaps together

\- 휴식 gaps are always visible

\- 휴식 gaps use weak visual styling

\- 휴식 gaps have no timer controls

\- 휴식 gaps are clickable insertion targets

\- mobile touch target must be large enough



Tests:

\- 휴식 gap appears when empty time exists

\- 휴식 gap has no timer controls

\- 휴식 gap is visually/structurally distinct from a real saved "휴식" activity

\- click target exists



\## Phase 3 — Fill 휴식 gap from chip board



Behavior:

\- clicking a 휴식 gap opens existing inline plan dropdown

\- dropdown target stores gap startMinute and durationMinutes

\- selecting an activity creates a real segment matching the full gap duration

\- parent and child activity selection both work

\- gap disappears after being filled

\- normal slot selection still works



Tests:

\- clicking 휴식 gap opens dropdown

\- selecting parent fills full gap

\- selecting child fills full gap with title/activity split

\- selected duration equals gap duration

\- virtual gap is not saved



\## Phase 4 — Resize real segments



Behavior:

\- add left/right resize handles to real segments

\- snap to 10-minute increments

\- minimum real segment duration is 10 minutes

\- shrinking creates visible 휴식 gap immediately

\- expanding into 휴식 gap consumes it

\- expanding into real segment is blocked unless safe auto-push is implemented

\- running timer segments cannot be resized



Tests:

\- right shrink creates trailing 휴식 gap

\- left shrink creates leading 휴식 gap

\- expanding into 휴식 gap works

\- minimum duration enforced

\- running segment resize blocked



\## Phase 5 — Activity title inline editing



Behavior:

\- only activity title text click starts editing

\- whole segment click must not start editing

\- Enter saves

\- Escape cancels

\- blur saves

\- empty value keeps previous value

\- match existing activity catalog item if available

\- otherwise create a new independent activity

\- do not rename existing catalog entries



Tests:

\- title click opens editor

\- segment background click does not

\- Enter/Escape/blur behavior

\- empty value preserves previous activity



\## Phase 6 — Segment background drag



Behavior:

\- drag starts only from non-interactive real segment background

\- snap to 10-minute increments

\- show ghost/preview

\- dropping into 휴식 gap is allowed if it fits

\- overlapping drop is blocked unless safe auto-push exists

\- successful move leaves 휴식 gap behind

\- running segments cannot be moved

\- dropdown must not open during drag



Tests:

\- background drag moves segment

\- old location becomes 휴식 gap

\- valid drop into 휴식 gap works

\- overlapping drop blocked

\- excluded targets do not start drag



\## Phase 7 — Toolbar and edit actions



Toolbar:

\- appears only for real segments

\- does not appear for 휴식 gaps

\- actions: split, merge, duplicate, delete

\- toolbar clicks do not start drag



Actions:

\- split real segment in half

\- merge only adjacent compatible real segments

\- delete returns time to 휴식 gap

\- duplicate places copy in nearest 휴식 gap that fits

\- running segments are protected



Tests:

\- toolbar appears for real segment

\- toolbar not shown for 휴식 gap

\- split/merge/delete/duplicate behavior

\- delete creates 휴식 gap

\- duplicate fills nearest 휴식 gap



\## Phase 8 — Row swap



Behavior:

\- add small row drag handle

\- row handle swaps full row plan contents

\- segment drag must not trigger row swap

\- row drag must not trigger segment move

\- recalculate segment start times after swap

\- running segment row swap should be blocked or follow existing confirmation pattern



Tests:

\- row swap exchanges row contents

\- only row handle starts row swap

\- row swap and segment drag do not conflict



\## Phase 9 — Regression pass



Verify:

\- timer start/pause/resume still works

\- activity chip board still opens

\- child activity popover still opens and remains anchored

\- child activity composer remains directly visible

\- direct activity selection still applies to selected target

\- plan-only dropdown still works

\- mobile input context still works

\- npm test passes



\## Stop rules for unattended run



\- Work on branch feature/direct-manipulation-segments.

\- Commit after each passing phase.

\- Never push to main.

\- If npm test fails after two fix attempts, stop and summarize.

\- If a phase requires unrelated rewrites, stop and explain.

\- If a single phase exceeds 800 changed lines, stop and summarize.

\- Prefer pure helpers and tests over large inline event-handler rewrites.



\## Minimum acceptable overnight result



\- virtual 휴식 gap helper model complete

\- 휴식 gap is not persisted

\- 휴식 gap rendering partially or fully implemented

\- 휴식 gap click target design identified

\- existing activity chip board not broken

\- npm test passing



\## Strong overnight result



\- 휴식 gap calculation complete

\- 휴식 gap always rendered

\- clicking 휴식 gap opens activity chip board

\- selecting activity fills the full gap duration

\- basic resize shrink creates visible 휴식 gap

\- npm test passing

EOF

