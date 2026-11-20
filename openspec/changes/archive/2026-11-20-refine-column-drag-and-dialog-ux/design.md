# Design

## Context

See `proposal.md` for motivation and the spec delta for the behavior contract.

- `App` owns one `DndContext`. Columns are registered only as `useDroppable({ id: 'column:<id>' })`; tasks use `useSortable`. The drag overlay and preview model are task-specific in `useDragPreview`.
- Column reordering currently goes through header `‹`/`›` buttons that call `moveColumn(column, direction)`, which swaps two IDs and sends `column/reorder`.
- `TaskDialog` and `ConfirmDialog` both render `Modal`, which always registers a capture-phase Escape/Tab handler, moves focus on mount and restores focus on unmount. The current Delete handler closes the task dialog before opening the confirmation.
- Title, description, checklist title and checklist item text are plain controlled inputs that are editable as soon as the dialog opens. `TaskDialog` owns title/description and persists only on explicit Save; `ChecklistEditor` owns checklist state.
- The unarchived task-card change also modifies the task dialog and task drag behavior; this change must remain compatible with the click-to-open/`Alt+Arrow` card model already implemented.

## Goals / Non-Goals

**Goals:**

- Reorder columns with a header drag that feels like task dragging and leaves the column body for cards.
- Keep the task details visible and unchanged while a delete confirmation is stacked above it.
- Prevent accidental text edits by requiring one explicit activation per text field.
- Persist task and checklist edits automatically, with visible save status and safe conflict handling.
- Preserve keyboard access and the existing authoritative persistence/error model.

**Non-Goals:**

- Changing `column/reorder` or `board.yaml` semantics.
- Drag-and-drop for column configuration fields, board filters or multi-select.
- Editing tasks inline on the card.
- Replacing native form controls or adding a form library.

## Decisions

### 1. Header drag with a dedicated column preview

- Add a `useDraggable` registration for the column header (`id: 'column-drag:<columnId>'`) with `data: { kind: 'column', columnId }`. Keep the existing column `useDroppable` for task drops. The column body keeps its task behavior and never starts a column drag.
- Add a `useColumnDrag` hook in the webview:
  - `onDragStart` for a column stores the ordered column IDs and the active ID.
  - `onDragOver` resolves the target column from a `column:<id>` droppable or from a task's `columnId`, then reorders the preview ID list.
  - `onDragEnd` sends one `column/reorder` with the preview order and clears the preview in `finally`.
  - `onDragCancel` clears the preview.
- Render columns from the preview ID list while a column drag is active. The overlay renders a static column preview (color dot, title, task count) rather than a live `BoardColumn`, avoiding nested droppables/hooks.
- `App` routes DndContext events by `event.active.data.current?.kind`: `task` goes to `useDragPreview`, `column` goes to `useColumnDrag`. Task preview and column preview cannot be active together.
- Remove the `‹`/`›` buttons and their `canMoveLeft`/`canMoveRight` props. The header becomes focusable and handles `Alt+←/→` by calling the same reorder action, which sends the authoritative request directly.
- Header controls stop pointer events from reaching the drag activator so edit/delete clicks never start a drag.

- **Alternative considered**: make the whole column sortable with `useSortable`. Rejected: the column also needs to remain a task droppable, and a whole-column transform makes card dragging noisier.
- **Alternative considered**: rely only on sortable transforms for feedback. Rejected: the app already previews task order explicitly; a shared preview approach keeps behavior and rollback consistent.

### 2. Modal stack with one active modal

- Extend `Modal` with `layer?: 'base' | 'stacked'` and `inert?: boolean`.
  - `inert` renders the panel with `aria-hidden="true"` and the DOM `inert` attribute, skips focus trapping and skips handling Escape/backdrop.
  - The stacked layer uses a higher z-index and its own backdrop.
- `TaskDialog` forwards `inert` to `Modal`. `ConfirmDialog` gains `stacked` and passes it to `Modal`.
- `App` keeps `taskDialog` mounted when Delete task is activated: it only sets `confirm`. While a task confirmation is open, the task dialog renders inert. Escaping, cancelling or backdrop-clicking the confirmation clears only `confirm`; the browser restores focus to the previously focused Delete task button because the confirmation's Modal cleanup runs.
- `deleteTask` success closes both the confirmation and the task dialog; a failure closes only the confirmation, keeps the task dialog and shows the banner. Column deletion keeps the existing non-stacked confirmation.

- **Alternative considered**: give both modals the same layer and rely on DOM order. Rejected: both would trap focus and handle Escape, and the lower dialog would still be interactive.
- **Alternative considered**: hide the task dialog with CSS instead of inert. Rejected: hidden-but-focusable controls remain reachable by keyboard/assistive technology.

### 3. Click-to-edit text fields as a small reusable control

- Add a `ClickToEditField` wrapper for `input` and `textarea`:
  - `readOnly={!editable}`;
  - first `onClick` or `Enter`/`Space` on focus sets `editable`;
  - `editable` is component-local and stays true until unmount;
  - an `initiallyEditable` prop covers create mode and newly added checklist rows;
  - a `reveal` prop (for example when a validation error exists) forces the field editable without losing the user-enabled state.
- `TaskDialog` uses it for title and description. Editing an existing task starts read-only; creating a task starts editable. Errors for title reveal the field.
- `ChecklistEditor` uses it for checklist titles and item text, tracking enabled IDs/rows internally. Existing checklists start read-only, newly added checklist/item rows start editable, and errors reveal the affected field. Checkboxes and add/delete controls are unchanged.
- Read-only styling uses a quiet inset background and a pointer cursor to signal that the field can be activated; focus/activation returns the normal input surface.

- **Alternative considered**: render plain text and swap to an input on click. Rejected: it duplicates layout, breaks caret positioning and complicates error/aria wiring.
- **Alternative considered**: enable on focus only. Rejected: tabbing through a form would accidentally enable every field; the explicit click/Enter/Space step is intentional.

### 4. Debounced autosave with a single in-flight mutation

- `TaskDialog` keeps the editable draft and an autosave controller. Text changes schedule a ~400 ms debounce; selects, tags, deadline clears and checklist toggles schedule immediately. The timer is cleared on unmount.
- Before each save the draft is validated with the same rules used today. Invalid drafts are not sent; field errors remain visible and the status becomes unsaved/error.
- The controller allows at most one request in flight. Changes made while a request is pending replace the queued draft; on success the returned task revision is stored and the queued draft is sent next if it differs. This prevents duplicate submissions and stale-revision races from rapid typing.
- New task: the first valid draft calls `task/create`, stores the created task/revision locally and continues as updates. The parent still receives the task through the existing upsert dispatch, so the board reflects it immediately.
- App exposes small `onAutosave(payload, revision | null)` and `onReload(taskId)` callbacks. The dialog owns the draft/status; App owns the protocol dispatch/board snapshot. This keeps persistence out of the form while preserving the authoritative-state contract.
- Footer renders only Delete task (existing task) and Voltar. Voltar awaits the pending flush; if the draft is invalid or conflicted and unsaved, it asks before discarding. There is no Save/Create/Cancel button.
- A persistent top label states that changes are saved automatically and shows `Saving…`, `Saved`, `Unsaved` or `Could not save` using `role="status"`.
- On conflict, the dialog keeps the local draft, shows the conflict message and offers Reload. Reload calls `onReload`, replaces the draft with the latest persisted task and clears the conflict state. Autosave never retries by force-overwriting.

- **Alternative considered**: save on blur only. Rejected by the chosen behavior; it loses work if the dialog closes unexpectedly and makes status less predictable.
- **Alternative considered**: optimistic retry with the latest revision after conflict. Rejected: it can silently overwrite another user's newer task/checklist content.

### 5. Concurrency coverage at the service and UI layers

- Service tests use `Promise.all` against the real filesystem-backed service for two task updates and for checklist mutations sharing one revision, asserting one wins and the other raises `ConflictError` while the YAML stays valid.
- Board-file concurrency is tested by writing `board.yaml` externally and then issuing a board-revision mutation, and by racing two board-revision mutations; the stale request must fail without rewriting the external configuration.
- UI tests drive rapid draft changes through fake timers to prove debounce/coalescing, one in-flight request, Back flushing, conflict retention and explicit Reload. The extension-host suite covers the create-then-update autosave path where practical.

## Risks / Trade-offs

- **Column and task drags compete for the same DndContext events** → tag active data with `kind`, route explicitly, and keep column drag activation on the header only.
- **Two modals can double-handle Escape/Tab** → one active modal policy: the lower dialog is `inert` and skips handlers; test Escape, backdrop and focus restoration.
- **Click-to-edit can feel unresponsive on read-only inputs** → use a distinct cursor/background, a one-click activation with focus retained, and `aria-readonly` semantics.
- **Validation errors in fields the user never activated** → reveal/enable error fields and keep focus/error associations intact.
- **Autosave races from fast typing or checklist toggles** → debounce text, schedule controls immediately, keep one in-flight request and chain the queued draft on the returned revision.
- **Autosave conflict overwrites newer content** → never force retry; keep local draft, surface conflict and require explicit Reload.
- **Voltar closes before the last keystroke persists** → flush the pending debounce/in-flight save and only close after it settles or the user discards a failed draft.
- **Auto-create duplicates tasks** → create only once per dialog, based on a valid title/column and the absence of a current task ID, and reuse the returned ID for updates.
- **Column preview reorder plus width changes can jitter** → keep fixed column width and use the same transition tokens as cards; test with three columns and a narrow board.
- **Deleting while unsaved details edits exist** → deletion is an explicit destructive action; the autosave controller is cancelled/ignored after a successful delete and the stacked confirmation remains the only destructive step.

## Migration Plan

- No data or protocol migration. Column reordering still uses `column/reorder`.
- Existing tests and flows remain valid except the removed column arrow buttons and the changed modal close order, which are covered by updated UI tests.
- No stored preference changes.
