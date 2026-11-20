# Tasks

## 1. Column drag reordering

- [x] 1.1 Add pure helpers to move a column ID to another position and to resolve a target column from a column droppable or task ID; verify normal, first/last, empty-board, task-target and no-op cases in unit tests.
- [x] 1.2 Add a `useColumnDrag` hook that owns the preview column order, starts only for column drags, reorders on pointer movement and sends one `column/reorder` on drop with preview cleanup on cancel/failure; verify start, preview, drop, cancel and rejection in hook tests.
- [x] 1.3 Register the column header as the draggable surface, remove the `‹`/`›` buttons and `canMoveLeft`/`canMoveRight` props, stop header controls from starting a drag, and add `Alt+←/→` reordering on a focused header; verify header controls, keyboard moves and boundary no-ops in BoardColumn/App tests.
- [x] 1.4 Route DndContext events by active kind so task and column drags stay independent, render columns from the preview order during a column drag and render a column overlay; verify dragging a column does not move tasks and dragging a card does not reorder columns in App tests.
- [x] 1.5 Add the column drag styles (grab cursor, overlay, preview surface) and run the headless harness to confirm overlay, preview order, a single `column/reorder`, and restored order on failure.

## 2. Stacked delete confirmation

- [x] 2.1 Extend `Modal` with an inert lower-layer mode and a stacked higher-layer mode: skip focus trapping/Escape/backdrop handling when inert, mark the lower panel `aria-hidden`/`inert`, and give the stacked backdrop a higher z-index; verify Escape, Tab, backdrop and focus restoration in Modal/ConfirmDialog tests.
- [x] 2.2 Update the task delete flow in `App` so activating Delete opens the confirmation without closing the task dialog, cancelling/Escape closes only the confirmation, a successful delete closes both dialogs, and a failed delete keeps the task dialog with the error; verify each path in App tests.
- [x] 2.3 Cancel/ignore any pending autosave when a task is deleted so a late autosave cannot resurrect it; verify with a pending autosave plus deletion test.
- [x] 2.4 Style the stacked confirmation and verify the details dialog remains visible, inert and unchanged while the confirmation is on top.

## 3. Click-to-edit text fields

- [x] 3.1 Build a reusable `ClickToEditField` for inputs/textareas with read-only display, one-click or `Enter`/`Space` activation, `initiallyEditable` and `reveal` support, and a stable enabled state until unmount; verify mouse, keyboard, reveal, read-only and editable behavior in component tests.
- [x] 3.2 Use it for the task title and description: existing tasks start read-only, create mode starts editable, validation errors reveal the affected field, and activation alone does not persist anything; verify with TaskDialog tests.
- [x] 3.3 Use it for checklist titles and item text: existing rows start read-only, newly added rows start editable, errors reveal the row, and checkboxes/add/delete controls stay immediately interactive; verify with ChecklistEditor/TaskDialog tests.
- [x] 3.4 Add read-only field styling that signals click-to-edit using theme tokens and verify it in light, dark and high-contrast themes.

## 4. Autosave dialog

- [x] 4.1 Add an autosave controller/hook: debounce text changes (~400 ms), schedule select/tag/deadline/checklist changes immediately, validate before sending, keep one in-flight request and coalesce the latest queued draft; verify debounce, coalescing, chained revisions and invalid-draft suppression with fake timers in unit tests.
- [x] 4.2 Auto-create a task on the first valid draft, store the returned task/revision in the dialog, then autosave subsequent changes as updates; verify a single create, no duplicate create while pending and updates after creation in TaskDialog/App tests.
- [x] 4.3 Replace the task footer with only **Delete task** (existing tasks) and **Voltar**, add the persistent "Changes are saved automatically" label and live saving/saved/failed status, and remove Save/Create/Cancel actions; verify the footer, status states and accessibility in component tests.
- [x] 4.4 Make Voltar flush the pending save and close after it settles; keep the dialog open on failure and ask before discarding a failed/conflicting local draft; verify pending, success, failure and discard paths in TaskDialog tests.
- [x] 4.5 Handle `ConflictError` by keeping the local draft, showing an actionable conflict message and offering Reload; implement reload to adopt the latest persisted task and clear the conflict; verify local retention, reload and no silent overwrite in App/TaskDialog tests.
- [x] 4.6 Wire `onAutosave` and `onReload` through `App` while keeping protocol dispatch and snapshot updates in the host; verify the board reflects created/updated/deadline/checklist changes after autosave.

## 5. Concurrency tests

- [x] 5.1 Add service/repository tests racing two task updates against the same revision with `Promise.all`; assert exactly one succeeds, the other raises a conflict, the YAML remains valid and the winning fields are intact.
- [x] 5.2 Add service tests racing two checklist mutations against the same task revision; assert one persists, the other conflicts and neither loses or duplicates checklist items.
- [x] 5.3 Add board-file concurrency tests: write `board.yaml` externally, then issue a board-revision mutation with the old revision; also race two board-revision mutations. Assert the stale request fails, the external configuration is not overwritten and the file remains valid.
- [x] 5.4 Add UI autosave-concurrency tests with fake timers and pushed external snapshots: rapid edits coalesce, only one request is in flight, conflict keeps the local draft, Reload adopts persisted state and a late autosave cannot resurrect a deleted task.

## 6. Verification and documentation

- [x] 6.1 Update `README.md` and `CHANGELOG.md` for header column dragging, keyboard column reordering, stacked delete confirmation, click-to-edit fields, autosave, Delete/Voltar footer and conflict reload.
- [x] 6.2 Run `npm run check` and fix all type, lint and unit failures.
- [x] 6.3 Run `npm run test:integration` and confirm the existing extension flow, column reordering, autosave create/update and dialog behavior still pass.
- [x] 6.4 Perform a final visual/manual pass for header drag preview/rollback, stacked confirmation focus/Escape, click-to-edit fields, autosave status, Voltar flush and conflict reload across both card densities.
