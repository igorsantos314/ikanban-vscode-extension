# kanban-ui Specification

## Purpose

Defines the user-visible Kanban interface: board and card presentation, column and task interactions, the accessible create/edit task dialog, tag selection, checklist editing, drag-and-drop and state feedback.

## Requirements

### Requirement: Board layout

The board SHALL display the board title, columns in configured order, the task count for each column, task cards, priority indicators, tag badges, derived checklist progress, and actions to add a task, add a column, refresh the board and validate the board. The layout SHALL provide a dedicated empty state when there are no columns or tasks and a loading state while the board is being loaded. Columns SHALL scroll internally so a long column does not make the whole board unusable.

#### Scenario: Board displays persisted structure

- **WHEN** a board with three columns and several tasks is opened
- **THEN** the title, ordered columns, tasks, counts, priorities, tags and checklist progress are visible

#### Scenario: Column task count

- **WHEN** a column contains four tasks
- **THEN** its header displays a task count of four

#### Scenario: Empty system

- **WHEN** the selected workspace has no board
- **THEN** the interface shows an initialization empty state instead of an empty board frame

#### Scenario: Loading state

- **WHEN** the board is loading
- **THEN** the interface shows a loading indicator and does not display stale content as current

### Requirement: Theme-aware presentation

The interface SHALL adapt to the active VS Code light, dark and high-contrast themes without requiring a restart. It SHALL use theme-provided colors for backgrounds, foreground text, borders, focus indicators and status colors, and SHALL maintain readable contrast in all supported themes.

#### Scenario: Theme switch

- **WHEN** the user switches from a dark theme to a light theme
- **THEN** the board updates its colors without losing its current board state

#### Scenario: High contrast visibility

- **WHEN** a high-contrast theme is active
- **THEN** text, controls, focus outlines and tag labels remain distinguishable

### Requirement: Column interactions in the interface

The interface SHALL let users create a column, rename a column, change its color, reorder it and delete an empty column. Column forms SHALL validate the title and color before submission. Destructive actions SHALL show confirmation or an explicit rejection message. A rejection for a populated column or the final column SHALL explain why the action is not allowed and SHALL leave the displayed board unchanged. Successful column changes SHALL reflect the authoritative persisted result.

#### Scenario: Create column from the board

- **WHEN** the user uses the add-column action, enters a title and chooses a color, and confirms
- **THEN** the new column appears in the configured order

#### Scenario: Edit a column

- **WHEN** the user renames a column and saves
- **THEN** only the displayed title and persisted configuration change, while the column's tasks remain in place

#### Scenario: Reorder columns

- **WHEN** the user moves a column earlier in the ordered list
- **THEN** the board renders the new order

#### Scenario: Delete populated column rejected

- **WHEN** the user tries to delete a column containing tasks
- **THEN** the interface shows that the tasks must be moved or deleted first and the column remains

#### Scenario: Delete final column rejected

- **WHEN** the user tries to delete the only remaining column
- **THEN** the interface explains that the board must keep at least one column

### Requirement: Task card presentation

Each task card SHALL display a readable title, a concise description preview when present, its priority, every assigned tag as a chip with both an icon and a text label, and checklist completion progress when checklists exist. Tags SHALL NOT communicate meaning through color alone. Long titles and descriptions SHALL wrap or truncate without breaking the layout, and special characters SHALL render literally.

#### Scenario: Card renders all metadata

- **WHEN** a task has high priority, tags `issue` and `spec`, two checklists and a description
- **THEN** the card shows the priority, both tagged chips with icons and labels, the checklist progress and a description preview

#### Scenario: Card without optional data

- **WHEN** a task has no description, no tags and no checklists
- **THEN** the card renders cleanly without empty placeholders for those fields

#### Scenario: Long unbroken text

- **WHEN** a task title or description contains a very long unbroken string
- **THEN** the card layout remains intact and the content does not overflow the column

### Requirement: Task interactions

The interface SHALL let users create a task, open and edit a task, delete a task with confirmation, and drag a task between columns or within a column. Opening a task SHALL show its complete information in the reusable task dialog. A delete confirmation SHALL identify the task, and cancelling SHALL leave it unchanged. The interface SHALL keep the previous authoritative state and show an error when an operation fails.

#### Scenario: Create a task

- **WHEN** the user activates the add-task action in a column, completes the dialog and saves
- **THEN** the task appears in that column without a full page reload

#### Scenario: Open task details

- **WHEN** the user opens a task card
- **THEN** the dialog displays its title, description, column, priority, tags and all checklists and items

#### Scenario: Delete with confirmation

- **WHEN** the user confirms deletion of a task
- **THEN** the card disappears and the column count decreases

#### Scenario: Cancel deletion

- **WHEN** the user dismisses the delete confirmation
- **THEN** the task remains unchanged

#### Scenario: Failed task operation

- **WHEN** a create, update or delete request fails
- **THEN** the interface keeps the prior displayed state and shows the error message

### Requirement: Reusable task dialog

The interface SHALL provide one `TaskDialog` component used for both creation and editing. It SHALL include a required title, an optional multiline description, a required column, a priority of low, medium or high, a visual multi-select for tags, and an optional checklist editor. The dialog SHALL validate inputs before submission and display each validation error near its field. It SHALL disable duplicate submissions, show a saving state while persistence is pending, close only after successful persistence, keep all entered data available when persistence fails, and confirm before closing with unsaved changes. For an existing task, a failed save SHALL leave the persisted task unchanged.

#### Scenario: Create dialog validation

- **WHEN** the user submits the create dialog with a blank title
- **THEN** a title error is displayed next to the title field and no request is sent

#### Scenario: Edit dialog loads current values

- **WHEN** the user opens an existing task
- **THEN** every field and checklist reflects the persisted task

#### Scenario: Duplicate submission prevented

- **WHEN** the user activates Save twice while a save is pending
- **THEN** only one save request is sent and the button is disabled during the operation

#### Scenario: Saving state

- **WHEN** a save request is pending
- **THEN** the dialog shows a saving indicator and does not close early

#### Scenario: Close only on success

- **WHEN** persistence succeeds
- **THEN** the dialog closes and the board displays the saved task

#### Scenario: Failure keeps input

- **WHEN** persistence fails
- **THEN** the dialog remains open with the entered data and shows the error

#### Scenario: Discard confirmation

- **WHEN** the user closes a changed dialog without saving
- **THEN** the interface asks for confirmation before discarding the changes

#### Scenario: Column selection is required

- **WHEN** the user submits a task without a selected column
- **THEN** a column error is displayed and no request is sent

### Requirement: Visual tag selection

The task dialog SHALL present the four supported tags as selectable visual options. Each option SHALL show an icon, a readable label and a color treatment. Multiple tags SHALL be selectable and deselectable. The selected state SHALL be conveyed by more than color, such as an icon, check mark or `aria-pressed` state. Tag definitions SHALL be centralized and reused by the dialog and task cards.

#### Scenario: Select multiple tags

- **WHEN** the user selects `issue` and `chore`
- **THEN** both options show a selected state and both are included in the save request

#### Scenario: Deselect a tag

- **WHEN** the user selects a previously selected tag again
- **THEN** it is removed from the task's selected tags

#### Scenario: Tag meaning is not color-only

- **WHEN** the user views a tag chip or selector option
- **THEN** the tag's text label and icon identify it independently of its color

#### Scenario: Unsupported tag is unavailable

- **WHEN** the dialog displays tag options
- **THEN** only `issue`, `feat`, `chore` and `spec` are offered

### Requirement: Checklist editor in the task dialog

The task dialog SHALL support zero, one or multiple checklists. Users SHALL be able to add a checklist, rename it, delete it, add checklist items, edit item text, delete items and toggle item completion. Each checklist SHALL display derived completed and total counts. Empty checklists and checklists with zero items SHALL be valid. Checklist edits SHALL be saved atomically with the task update.

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

### Requirement: Task drag-and-drop

The interface SHALL provide drag-and-drop for moving a task between columns and reordering it within a column. Dropping SHALL send an authoritative move request containing the target column and target position. The interface SHALL update the displayed order only after the host confirms persistence; on failure it SHALL restore the previous order and show an error. Drag-and-drop SHALL be usable with a keyboard and SHALL not rely on color or pointer-only interaction.

#### Scenario: Move between columns

- **WHEN** the user drags a task from `backlog` and drops it in `in-progress`
- **THEN** the task is sent to the host, persisted in the target column and displayed there

#### Scenario: Reorder within a column

- **WHEN** the user drops a task above another task in the same column
- **THEN** the resulting order matches the drop position after persistence

#### Scenario: Failed drop restores state

- **WHEN** a move request fails
- **THEN** the task returns to its previous displayed position and an error is shown

#### Scenario: Keyboard move

- **WHEN** the user uses the keyboard controls exposed for a task card
- **THEN** the task can be moved to another column or position through an accessible alternative

### Requirement: Validation and operation feedback

The interface SHALL show a visible validation status when the board has validation issues, list the affected files and messages, and allow the user to open an affected file. It SHALL show success feedback for validation and refresh actions, and actionable error messages for failed operations. Failed changes SHALL never be silently discarded or displayed as persisted.

#### Scenario: Validation status visible

- **WHEN** the board has two invalid files
- **THEN** the interface shows a validation warning with an issue count and the affected files are listed

#### Scenario: Open an invalid file

- **WHEN** the user selects a validation issue
- **THEN** the host opens the affected file at the reported location when available

#### Scenario: Refresh feedback

- **WHEN** the user activates refresh and the reload succeeds
- **THEN** the board shows the refreshed state and no error

#### Scenario: No silent failure

- **WHEN** any host request returns an error
- **THEN** the interface displays the error and does not pretend the change succeeded

### Requirement: Accessible interface

The interface SHALL provide accessible names for controls, visible focus indicators, keyboard navigation for dialogs and actions, appropriate roles and states for tags and toggles, and focus management when a dialog opens or closes. Form errors SHALL be associated with their fields. The dialog SHALL trap focus while open and close with Escape only when doing so does not discard unsaved changes without confirmation.

#### Scenario: Keyboard-only task creation

- **WHEN** the user navigates with the keyboard only
- **THEN** they can open the add-task dialog, fill every field, select tags, edit checklists and save

#### Scenario: Field error association

- **WHEN** a required field is invalid
- **THEN** its error is announced or described in association with that field

#### Scenario: Dialog focus

- **WHEN** a dialog opens
- **THEN** focus moves into the dialog and is restored to the invoking control when it closes

### Requirement: Safe text rendering

All task and validation text SHALL be rendered with React text nodes or equivalent escaping. The interface SHALL NOT use unsanitized HTML injection for task titles, descriptions, YAML content, file paths or error messages. Markdown-looking and HTML-like content SHALL appear literally.

#### Scenario: Description with markup

- **WHEN** a task description contains `<b>bold</b>` or Markdown syntax
- **THEN** the literal text is shown and no HTML element is created from it

#### Scenario: Error message text

- **WHEN** a validation message includes a file path or YAML value
- **THEN** it is displayed as escaped text
