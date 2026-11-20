# Proposal

## Why

Column order can only be changed with the `‹` and `›` buttons, which feels inconsistent with the drag-based task movement and makes reordering several columns slow. The delete confirmation closes the task details dialog, so the user loses context and sees the board flash before deciding. The task dialog also opens with every text field already editable and requires an explicit Save, which makes reading and editing cumbersome and easy to get wrong. This change replaces that with autosave and makes the dialog honest about persistence by showing its status.

## What Changes

- Replace column arrow-button reordering with header drag-and-drop that follows the same model as task drag: a column overlay follows the pointer, the board previews the new order while dragging, the drop animates into place, and the move is persisted through `column/reorder` only after the drop. A failed request restores the previous order and shows an error.
- Drag a column by its header only, so the column body remains dedicated to task dragging.
- Remove the `‹` and `›` column buttons. A focused column header SHALL support `Alt+←/→` to reorder the column through the same authoritative request.
- Render the delete confirmation above the task details dialog instead of closing the details dialog first. The details dialog SHALL remain visible and inert behind the confirmation; cancelling or pressing Escape SHALL close only the confirmation and return focus to Delete task. The details dialog SHALL close only after deletion is confirmed and succeeds.
- Add click-to-edit behavior to text fields in the task details dialog. The title, description, checklist title and checklist item text SHALL start read-only. The first click (or `Enter`/`Space` for keyboard users) enables that field for editing, and it SHALL remain enabled until the dialog closes. Newly added checklist or item fields SHALL start enabled so the user can type immediately. Validation errors SHALL reveal/enable the affected field.
- Keep column, priority, tag and checklist toggles/buttons interactive as today; only text entry becomes click-to-edit.
- Replace the explicit save model with debounced autosave. Text edits SHALL persist shortly after typing stops, and select, date/time, tag and checklist changes SHALL persist as soon as they change. The dialog SHALL NOT show Save, Create or Cancel actions.
- Create a new task automatically once it has a non-empty title and a column, then continue autosaving it. Invalid drafts SHALL NOT be persisted and SHALL show their field error.
- Keep only **Delete task** (for existing tasks) and **Voltar** in the dialog footer. Voltar SHALL flush the pending autosave before closing; pending or failed local changes SHALL NOT be silently lost.
- Show a persistent informational label at the top of the dialog explaining that changes are saved automatically, with a live status when saving, saved or failed.
- On a conflict from an external task, checklist or board change, keep the local draft, show an actionable conflict message and offer an explicit reload. Autosave SHALL never silently overwrite the newer persisted content.
- Add automated concurrency coverage for simultaneous task edits, simultaneous checklist edits and a concurrent change to the main board file, including the conflict and rollback behavior surfaced by autosave.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kanban-ui`: column reordering becomes header drag-and-drop with overlay/preview/rollback and keyboard reordering; the delete confirmation stacks above the task dialog; task text fields use click-to-edit; the task dialog autosaves and exposes only Delete and Voltar actions with a visible autosave/conflict status.

## Impact

- **Webview**: `src/webview/App.tsx`, `src/webview/components/BoardColumn.tsx`, new column sortable/overlay behavior, `TaskDialog.tsx`, `ChecklistEditor.tsx`, new autosave/click-to-edit controls, `Modal.tsx` (stacking/inert behavior), `ConfirmDialog.tsx`, `styles.css`.
- **Persistence behavior**: the dialog coalesces autosaves per task, keeps one request in flight, uses the latest task revision on success and handles conflicts without overwriting external edits.
- **Existing requests**: column moves keep using `column/reorder`; no protocol, storage or board-format change.
- **Tests**: App/BoardColumn/TaskDialog/ChecklistEditor/Modal tests for drag preview, rollback, stacked confirmation, click-to-edit, debounce, create-on-first-valid-draft, Voltar flush and conflict handling; service/repository tests for simultaneous task edits, simultaneous checklist edits and a concurrent board-file change; extension-host coverage for the UI path where practical.
- **No breaking data changes**.

## Assumptions

- Autosave uses a short debounce for typing (roughly 400 ms) and immediate scheduling for selects, tags, deadline masks and checklist toggles.
- A new task is created once title, column and all currently required fields are valid; editing then continues as an update on the created task.
- Invalid drafts are never persisted and keep their field errors visible. Voltar closes after the pending save settles; if local changes failed or conflict, Voltar asks before discarding them.
- Column keyboard reordering uses `Alt+←/→` on the focused header, matching the `Alt+Arrow` convention already used by cards.
- Clicking the header controls (edit, delete) does not start a column drag.
- The delete confirmation keeps the existing confirmation text and confirmation flow; only its stacking and close behavior change.
- A text field enabled by click stays enabled until the task dialog closes, even after losing focus.
