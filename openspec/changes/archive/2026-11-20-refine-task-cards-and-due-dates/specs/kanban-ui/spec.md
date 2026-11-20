# Spec Delta

## MODIFIED Requirements

### Requirement: Task card presentation

Each task card SHALL display a readable title, its priority with a distinguishing icon, every assigned tag as a chip with both an icon and a text label, and checklist completion progress when checklists exist. The default `expanded` density SHALL also show a concise description preview when present and the last-updated metadata. When a task has a deadline, the card SHALL display it in the user's local timezone, using a short form in `compact` density and a full date and time in `expanded` density, and SHALL visually mark a deadline that is already past. Tags SHALL NOT communicate meaning through color alone, and an overdue deadline SHALL NOT be communicated by color alone. Long titles and descriptions SHALL wrap or truncate without breaking the layout, and special characters SHALL render literally.

#### Scenario: Card renders all metadata

- **WHEN** a task has high priority, tags `issue` and `spec`, two checklists, a description and a deadline
- **THEN** the card shows the priority icon and label, both tagged chips with icons and labels, the checklist progress, the description preview and the deadline

#### Scenario: Card without optional data

- **WHEN** a task has no description, no tags, no checklists and no deadline
- **THEN** the card renders cleanly without empty placeholders for those fields

#### Scenario: Long unbroken text

- **WHEN** a task title or description contains a very long unbroken string
- **THEN** the card layout remains intact and the content does not overflow the column

#### Scenario: Priority icon is independent of color

- **WHEN** a task has low, medium or high priority
- **THEN** its priority indicator includes an icon that distinguishes the level, and in `expanded` density also a readable text label

#### Scenario: Deadline is shown in local time

- **WHEN** a task's deadline is stored in UTC and the user's timezone is not UTC
- **THEN** the card displays the deadline converted to the user's local time

#### Scenario: Overdue deadline is not color-only

- **WHEN** a task's deadline is earlier than the current time
- **THEN** the card shows an overdue label or accessible state in addition to any color treatment

### Requirement: Task interactions

The interface SHALL let users create a task, open and edit a task, delete a task with confirmation, and drag a task between columns or within a column. Opening a task SHALL show its complete information in the reusable task dialog. A single click or `Enter` anywhere on a task card SHALL open that task in the dialog, while a pointer movement beyond the drag activation distance SHALL move the card instead. Deleting SHALL be available from the task dialog and SHALL require confirmation that identifies the task; cancelling SHALL leave it unchanged. The card itself SHALL NOT expose separate delete or column-arrow buttons. The interface SHALL keep the previous authoritative state and show an error when an operation fails.

#### Scenario: Create a task

- **WHEN** the user activates the add-task action in a column, completes the dialog and saves
- **THEN** the task appears in that column without a full page reload

#### Scenario: Open task details

- **WHEN** the user single-clicks anywhere on a task card without dragging
- **THEN** the task dialog opens with that task's information

#### Scenario: Open task from the keyboard

- **WHEN** a task card has keyboard focus and the user presses `Enter`
- **THEN** the task dialog opens for that task

#### Scenario: Delete with confirmation

- **WHEN** the user opens an existing task, activates Delete task and confirms
- **THEN** the card disappears and the column count decreases

#### Scenario: Cancel deletion

- **WHEN** the user dismisses the delete confirmation
- **THEN** the task remains unchanged

#### Scenario: Card has no separate action buttons

- **WHEN** a task card is displayed in any density
- **THEN** it does not render delete or column-move arrow buttons

#### Scenario: Failed task operation

- **WHEN** a create, update, deadline or delete request fails
- **THEN** the interface keeps the prior displayed state and shows the error message

### Requirement: Reusable task dialog

The interface SHALL provide one `TaskDialog` component used for both creation and editing. It SHALL include a required title, an optional multiline description, a required column, a priority of low, medium or high, a visual multi-select for tags, an optional checklist editor and an optional deadline editor. The deadline editor SHALL provide separate masked local-time date and time fields: `DD/MM/AAAA` and `HH:MM`, accepting only digits, inserting separators automatically and moving between fields quickly. A deadline SHALL require both a date and a time; filling only one SHALL produce a field error, and an explicit clear action SHALL remove the deadline. The dialog SHALL validate inputs before submission and display each validation error near its field. It SHALL disable duplicate submissions, show a saving state while persistence is pending, close only after successful persistence, keep all entered data available when persistence fails, and confirm before closing with unsaved changes. For an existing task, the dialog SHALL offer a colored, icon-bearing **Delete task** action that identifies the task and requires confirmation. Save/Create and Cancel actions SHALL be visually distinct through color and an icon, not color alone. A failed save SHALL leave the persisted task unchanged.

#### Scenario: Create dialog validation

- **WHEN** the user submits the create dialog with a blank title
- **THEN** a title error is displayed next to the title field and no request is sent

#### Scenario: Edit dialog loads current values

- **WHEN** the user opens an existing task
- **THEN** every field, including the local date and time of the deadline, reflects the persisted task

#### Scenario: Deadline mask accepts quick entry

- **WHEN** the user types `251120261430` in the deadline fields
- **THEN** the dialog shows `25/11/2026` and `14:30` with separators inserted

#### Scenario: Partial deadline is rejected

- **WHEN** the user fills only the date or only the time and submits
- **THEN** a deadline error is displayed and no request is sent

#### Scenario: Clear the deadline

- **WHEN** the user activates the clear action on an existing deadline and saves
- **THEN** the persisted task no longer has a deadline

#### Scenario: Invalid calendar date is rejected

- **WHEN** the user enters `31/02/2026` and submits
- **THEN** a deadline error is displayed and no request is sent

#### Scenario: Delete action is available for existing tasks

- **WHEN** the dialog is open for an existing task
- **THEN** a colored Delete task action with an icon is present and asks for confirmation before deleting

#### Scenario: Delete action is absent when creating

- **WHEN** the dialog is open to create a new task
- **THEN** no Delete task action is shown

#### Scenario: Save and Cancel are distinguishable

- **WHEN** the dialog footer is displayed
- **THEN** Save/Create and Cancel use distinct colors and icons in addition to their text labels

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

### Requirement: Task drag-and-drop

The interface SHALL provide drag-and-drop for moving a task between columns and reordering it within a column. The entire task card SHALL be the drag surface and SHALL NOT require a separate drag handle. The interface SHALL distinguish a single click from a drag using an activation distance: a pointer release below that distance SHALL open the task, and movement beyond it SHALL start dragging and suppress the click. While a task is being dragged, the interface SHALL display a drag overlay that follows the pointer or keyboard movement, SHALL preview the target column and insertion position in the underlying board, and SHALL reserve space at the prospective drop position. Dropping SHALL send an authoritative move request containing the target column and target position. The interface SHALL update the persisted displayed order only after the host confirms persistence; on failure it SHALL restore the previous order and show an error. Keyboard users SHALL be able to move a focused card with `Alt+←/→` between columns and `Alt+↑/↓` within its column, and drag-and-drop SHALL not rely on color or pointer-only interaction.

#### Scenario: Move between columns

- **WHEN** the user drags a task from `backlog` and drops it in `in-progress`
- **THEN** the task is sent to the host, persisted in the target column and displayed there

#### Scenario: Click does not drag

- **WHEN** the user presses and releases on a card without moving beyond the activation distance
- **THEN** no move request is sent and the task dialog opens

#### Scenario: Whole card is draggable

- **WHEN** the user starts dragging from the title or metadata area of a card
- **THEN** the drag starts without a separate drag handle

#### Scenario: Cross-column preview during drag

- **WHEN** the user drags a task over another column
- **THEN** the target column highlights, the insertion position is shown in that column and the source column no longer presents the task as if it were already removed

#### Scenario: Animated drop

- **WHEN** the user releases a dragged task over a valid position
- **THEN** the card animates from the overlay to its final position instead of disappearing and reappearing abruptly

#### Scenario: Reorder within a column

- **WHEN** the user drops a task above another task in the same column
- **THEN** the resulting order matches the drop position after persistence

#### Scenario: Failed drop restores state

- **WHEN** a move request fails
- **THEN** the task returns to its previous displayed position and an error is shown

#### Scenario: Keyboard move

- **WHEN** the user uses the keyboard controls exposed for a focused task card
- **THEN** the task can be moved to another column or position through an accessible alternative

#### Scenario: Keyboard move between columns

- **WHEN** a focused card receives `Alt+ArrowRight` or `Alt+ArrowLeft`
- **THEN** the task moves to the adjacent column through the authoritative move request

#### Scenario: Keyboard reorder within a column

- **WHEN** a focused card receives `Alt+ArrowUp` or `Alt+ArrowDown`
- **THEN** the task moves one position within its column through the authoritative move request

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion
- **THEN** drag feedback remains usable without long animations

## ADDED Requirements

### Requirement: Two-line compact card

When the `compact` density is selected, every task card SHALL render exactly two lines. The first line SHALL contain only the title, truncated to one line with an accessible full-title alternative. The second line SHALL contain the priority icon, checklist progress when present, tag icons when present, and the short local deadline when present. Compact cards SHALL NOT render the description, tag text labels, updated timestamp, checklist progress bar or action buttons. The `expanded` density SHALL remain the complete card presentation. The selected density SHALL apply to every card at once, remain switchable without reloading the board and persist for the workspace.

#### Scenario: Compact renders two lines

- **WHEN** a task with a description, tags, a checklist, a deadline and priority is displayed in compact density
- **THEN** the card shows only a one-line title and one metadata line with priority, checklist count, tag icons and deadline

#### Scenario: Compact omits heavy content

- **WHEN** a card is displayed in compact density
- **THEN** no description, tag text label, updated timestamp, progress bar or action button is rendered

#### Scenario: Long title in compact

- **WHEN** a compact card title exceeds the available width
- **THEN** the title is truncated to one line and the full title remains available to assistive technology

#### Scenario: Expanded is unchanged

- **WHEN** the user switches back to expanded density
- **THEN** descriptions, tag labels, timestamps, checklist bars and deadlines reappear without changing board data

#### Scenario: Density persists

- **WHEN** the user reloads or reopens the board after choosing compact
- **THEN** the board restores the compact density for that workspace

#### Scenario: Default density

- **WHEN** the workspace has no saved density preference
- **THEN** the board uses the expanded density
