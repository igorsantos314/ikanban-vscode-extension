# Spec Delta

## MODIFIED Requirements

### Requirement: Column interactions in the interface

The interface SHALL let users create a column, rename a column, change its color, reorder it and delete an empty column. Reordering SHALL use drag-and-drop from the column header: a column overlay follows the pointer, the board previews the new column order during the drag and the drop animates into place. The move SHALL be persisted through the authoritative column reorder request only after the drop; a failed request SHALL restore the previous order and show an error. Dragging in the column body SHALL continue to move tasks and SHALL NOT reorder the column. Column forms SHALL validate the title and color before submission. Destructive actions SHALL show confirmation or an explicit rejection message. A rejection for a populated column or the final column SHALL explain why the action is not allowed and SHALL leave the displayed board unchanged. Successful column changes SHALL reflect the authoritative persisted result. The header SHALL NOT expose separate left/right reorder buttons; a focused header SHALL support `Alt+←/→` to reorder the column through the same authoritative request.

#### Scenario: Create column from the board

- **WHEN** the user uses the add-column action, enters a title and chooses a color, and confirms
- **THEN** the new column appears in the configured order

#### Scenario: Edit a column

- **WHEN** the user renames a column and saves
- **THEN** only the displayed title and persisted configuration change, while the column's tasks remain in place

#### Scenario: Reorder columns

- **WHEN** the user drags a column by its header and drops it at a new position
- **THEN** the board previews that order during the drag and renders the persisted order after the drop

#### Scenario: Header drag does not start from column controls

- **WHEN** the user presses on the edit or delete control in the column header
- **THEN** the control's action runs and no column drag starts

#### Scenario: Column body still moves tasks

- **WHEN** the user drags a task from the column body
- **THEN** the task moves as before and the column order does not change

#### Scenario: Failed column reorder restores order

- **WHEN** the column reorder request fails
- **THEN** the board returns to the previous column order and shows the error

#### Scenario: Keyboard column reorder

- **WHEN** a column header has focus and receives `Alt+ArrowLeft` or `Alt+ArrowRight`
- **THEN** the column moves one position through the authoritative reorder request

#### Scenario: No arrow buttons

- **WHEN** a column header is rendered
- **THEN** it does not show separate left/right reorder buttons

#### Scenario: Delete populated column rejected

- **WHEN** the user tries to delete a column containing tasks
- **THEN** the interface shows that the tasks must be moved or deleted first and the column remains

#### Scenario: Delete final column rejected

- **WHEN** the user tries to delete the only remaining column
- **THEN** the interface explains that the board must keep at least one column

### Requirement: Reusable task dialog

The interface SHALL provide one `TaskDialog` component used for both creation and editing. It SHALL include a required title, an optional multiline description, a required column, a priority of low, medium or high, a visual multi-select for tags, an optional checklist editor and an optional deadline editor. The deadline editor SHALL provide separate masked local-time date and time fields: `DD/MM/AAAA` and `HH:MM`, accepting only digits, inserting separators automatically and moving between fields quickly. A deadline SHALL require both a date and a time; filling only one SHALL produce a field error, and an explicit clear action SHALL remove the deadline. Text-entry fields SHALL use click-to-edit behavior: title, description, checklist title and checklist item text SHALL start read-only, become editable on the first click or an explicit keyboard activation, and remain editable until the dialog closes. Newly added checklist or item text fields SHALL start editable, and a validation error SHALL reveal and enable its field. Column, priority, tags, deadline masks and checklist toggles SHALL remain interactive without an extra activation step.

The dialog SHALL autosave changes. Text edits SHALL be persisted after a short debounce following the last keystroke, while column, priority, tag, deadline and checklist changes SHALL be scheduled as soon as they change. The dialog SHALL show a persistent informational label at the top stating that changes are saved automatically, plus a live saving/saved/failed status. It SHALL NOT show Save, Create or Cancel actions. For an existing task the footer SHALL show only **Delete task** and **Voltar**; for a new task it SHALL show only **Voltar**. Voltar SHALL flush a pending autosave and close the dialog after the save settles. A new task SHALL be created automatically once title, column and all required fields are valid, and subsequent edits SHALL update the created task.

The dialog SHALL prevent duplicate in-flight saves by coalescing rapid changes and SHALL keep only one autosave request pending per task. Invalid drafts SHALL NOT be persisted and SHALL display their field errors. If an autosave fails or conflicts with a newer external version, the dialog SHALL keep the local draft, show an actionable error and offer an explicit reload; it SHALL never silently overwrite the newer persisted content. If Voltar is used while a failed or conflicting local draft remains unsaved, the dialog SHALL ask before discarding it. For an existing task, the dialog SHALL offer a colored, icon-bearing Delete task action that requires confirmation. A failed save SHALL leave the last successfully persisted task unchanged.

#### Scenario: Create dialog validation

- **WHEN** the user leaves the title blank while creating a task
- **THEN** a title error is displayed next to the title field and no task file is created

#### Scenario: Edit dialog loads current values

- **WHEN** the user opens an existing task
- **THEN** every field, including the local date and time of the deadline, reflects the persisted task

#### Scenario: Text fields start read-only

- **WHEN** an existing task dialog opens
- **THEN** the title, description, checklist titles and checklist item texts are rendered read-only until the user activates them

#### Scenario: Click enables a field

- **WHEN** the user clicks the read-only title or description field
- **THEN** that field becomes editable, stays enabled until the dialog closes and accepts text input

#### Scenario: Keyboard activates a field

- **WHEN** a read-only text field has focus and the user presses `Enter` or `Space`
- **THEN** the field becomes editable without submitting the dialog

#### Scenario: Validation reveals a field

- **WHEN** an autosave cannot persist a text field
- **THEN** the affected field is enabled and its error is shown next to it

#### Scenario: New checklist field is immediately editable

- **WHEN** the user adds a checklist or checklist item
- **THEN** the new title or item text field is editable without an extra click

#### Scenario: Non-text controls stay interactive

- **WHEN** the user opens an existing task and changes the column, priority, tags or checklist checkbox
- **THEN** those controls respond immediately without a click-to-enable step

#### Scenario: Autosave while typing

- **WHEN** the user edits the title or description and stops typing
- **THEN** the change is persisted after the debounce without a Save or Enter action

#### Scenario: Autosave of a control change

- **WHEN** the user changes the column, priority, tag, deadline or checklist checkbox
- **THEN** the change is scheduled for persistence immediately

#### Scenario: Auto-create new task

- **WHEN** a new task dialog reaches a valid non-empty title and column
- **THEN** the task is created automatically and further edits autosave as updates

#### Scenario: Only Delete and Voltar actions

- **WHEN** the task dialog footer is displayed for an existing task
- **THEN** it shows Delete task and Voltar, with no Save, Create or Cancel action

#### Scenario: Voltar for a new task

- **WHEN** the task dialog is creating a task that is not yet valid
- **THEN** the footer shows only Voltar and activating it closes without creating a file

#### Scenario: Autosave status label

- **WHEN** the task dialog is open
- **THEN** a visible label explains that changes are saved automatically and reports saving, saved or failed state

#### Scenario: Deadline mask accepts quick entry

- **WHEN** the user types `251120261430` in the deadline fields
- **THEN** the dialog shows `25/11/2026` and `14:30` with separators inserted

#### Scenario: Partial deadline is rejected

- **WHEN** the user fills only the date or only the time
- **THEN** a deadline error is displayed and the partial value is not persisted

#### Scenario: Clear the deadline

- **WHEN** the user activates the clear action on an existing deadline
- **THEN** the deadline is removed by autosave and the persisted task no longer has it

#### Scenario: Invalid calendar date is rejected

- **WHEN** the user enters `31/02/2026`
- **THEN** a deadline error is displayed and the invalid value is not persisted

#### Scenario: Duplicate submission prevented

- **WHEN** the user changes several fields in quick succession
- **THEN** autosave coalesces them into one in-flight request and does not send duplicate overlapping saves for the same task

#### Scenario: Saving state

- **WHEN** an autosave request is pending
- **THEN** the dialog status reports that it is saving and the dialog does not claim the change is saved

#### Scenario: Close only on success

- **WHEN** the user activates Voltar while an autosave is pending
- **THEN** the dialog waits for the save to settle and closes only after it succeeds or the user explicitly discards a failed draft

#### Scenario: Failure keeps input

- **WHEN** an autosave fails
- **THEN** the dialog remains open with the entered data and shows the error

#### Scenario: Discard confirmation

- **WHEN** the user activates Voltar with a failed or conflicting local draft that has not been persisted
- **THEN** the interface asks before discarding it

#### Scenario: Column selection is required

- **WHEN** a task has no selected column
- **THEN** a column error is displayed and autosave does not create or update the task

#### Scenario: Conflict keeps local draft

- **WHEN** a task or checklist was changed outside the dialog and an autosave conflicts
- **THEN** the local draft remains visible, a conflict message is shown and an explicit reload is offered

#### Scenario: Reload adopts persisted state

- **WHEN** the user activates reload after a conflict
- **THEN** the dialog replaces the local draft with the latest persisted task and clears the conflict state

#### Scenario: Delete action is available for existing tasks

- **WHEN** the dialog is open for an existing task
- **THEN** a colored Delete task action with an icon is present and asks for confirmation before deleting

#### Scenario: Delete action is absent when creating

- **WHEN** the dialog is open for a task that has not been created
- **THEN** no Delete task action is shown

### Requirement: Checklist editor in the task dialog

The task dialog SHALL support zero, one or multiple checklists. Users SHALL be able to add a checklist, rename it, delete it, add checklist items, edit item text, delete items and toggle item completion. Each checklist SHALL display derived completed and total counts. Empty checklists and checklists with zero items SHALL be valid. Checklist edits SHALL be autosaved with the task using the same debounce/coalescing rules as other task fields and SHALL be saved atomically in each update. Existing checklist titles and item texts SHALL start read-only and become editable on the first click or explicit keyboard activation, remaining enabled until the dialog closes. Newly created checklist and item fields SHALL start editable. Checkboxes and add/delete actions SHALL remain interactive without click-to-edit. Concurrent checklist changes to the same task SHALL never silently overwrite a newer revision; the losing change SHALL surface a conflict and keep its local state.

#### Scenario: Add a checklist and items

- **WHEN** the user adds a checklist and two items and saves the task
- **THEN** both items are persisted inside the task YAML and appear after reopening the task

#### Scenario: Toggle an item

- **WHEN** the user marks a checklist item complete in the dialog and saves
- **THEN** the persisted item is complete and the checklist progress updates

#### Scenario: Delete a checklist

- **WHEN** the user deletes a checklist from the dialog and saves
- **THEN** the checklist and its items are removed from the persisted task

#### Scenario: Empty checklist progress

- **WHEN** a checklist has no items
- **THEN** the editor displays `0/0` or an equivalent completed-of-total indicator

#### Scenario: Checklist edits are saved atomically

- **WHEN** a task save containing title, tag and checklist changes fails
- **THEN** none of those changes are persisted

#### Scenario: Existing checklist fields start read-only

- **WHEN** an existing task with checklists is opened
- **THEN** its checklist titles and item texts are rendered read-only until activated

#### Scenario: New checklist is editable

- **WHEN** the user adds a new checklist or item
- **THEN** the new title or item text field accepts typing immediately

#### Scenario: Checklist changes autosave

- **WHEN** the user toggles an item or edits checklist text and stops interacting
- **THEN** the checklist change is persisted by autosave without a Save action

#### Scenario: Concurrent checklist edit conflicts

- **WHEN** the same task receives a checklist autosave while another checklist change already updated its revision
- **THEN** one change persists, the other keeps its local draft and reports a conflict instead of overwriting the newer checklist state

## ADDED Requirements

### Requirement: Stacked delete confirmation

When the user activates Delete task from an existing task dialog, the interface SHALL keep the task dialog mounted and visible behind a higher-layer confirmation. The underlying task dialog SHALL become inert and SHALL NOT receive pointer or keyboard input while the confirmation is open. The confirmation SHALL be the only active modal dialog, focus SHALL move into it, and cancelling, pressing Escape or clicking the confirmation backdrop SHALL close only the confirmation and restore focus to the Delete task action in the task dialog. The task dialog SHALL remain unchanged and SHALL NOT close unless deletion is confirmed and the delete operation succeeds.

#### Scenario: Confirmation overlays the details dialog

- **WHEN** the user activates Delete task in an open task dialog
- **THEN** the confirmation appears above the still-visible task details dialog

#### Scenario: Details are inert behind confirmation

- **WHEN** the delete confirmation is open
- **THEN** the task details dialog cannot be edited or focused

#### Scenario: Cancel keeps details open

- **WHEN** the user cancels the delete confirmation
- **THEN** only the confirmation closes, the task dialog remains open with its current data and focus returns to Delete task

#### Scenario: Escape closes only confirmation

- **WHEN** the user presses Escape while the delete confirmation is open
- **THEN** the confirmation closes and the task dialog remains open

#### Scenario: Confirm deletes and closes details

- **WHEN** the user confirms deletion and the delete request succeeds
- **THEN** both the confirmation and the task details dialog close and the task disappears from the board

#### Scenario: Failed delete keeps details

- **WHEN** the delete request fails
- **THEN** the confirmation closes, the task dialog remains open with its data and the error is shown

### Requirement: Autosave concurrency safety

Autosave SHALL remain safe when changes overlap. The interface SHALL keep at most one in-flight mutation per task and SHALL serialize subsequent changes through the latest confirmed revision. Two autosaves for the same task SHALL NOT both succeed against the same revision; the later one SHALL either use the revision returned by the first successful response or surface a conflict. Concurrent checklist edits SHALL follow the same rule. A change to `board.yaml` by another process SHALL invalidate board-scoped operations that carry the old board revision, and the interface SHALL report the conflict and reload the board instead of overwriting the external change.

#### Scenario: Simultaneous task changes

- **WHEN** two task updates reach the host against the same task revision at the same time
- **THEN** exactly one succeeds, the other reports a conflict and no field is lost silently

#### Scenario: Simultaneous checklist changes

- **WHEN** two checklist mutations target the same task revision at the same time
- **THEN** exactly one persists and the other surfaces a conflict with the local checklist state preserved

#### Scenario: Board file changed externally

- **WHEN** `board.yaml` changes externally while a board-scoped mutation uses the previous board revision
- **THEN** the mutation is rejected with a conflict, the board reloads and the external configuration is not overwritten

#### Scenario: Autosave coalescing

- **WHEN** several autosave-worthy changes occur before the first request completes
- **THEN** only one request is in flight and the final local draft is sent against the revision returned by the previous success

#### Scenario: Conflict does not corrupt the board

- **WHEN** any concurrent autosave conflicts
- **THEN** the persisted board and task documents remain valid and contain the winning change intact
