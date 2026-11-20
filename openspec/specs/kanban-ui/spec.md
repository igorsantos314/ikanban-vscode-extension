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

### Requirement: Task timestamp metadata in the dialog

When an existing task is opened in the reusable task dialog, the dialog SHALL display its creation and last-updated timestamps as read-only metadata. The values SHALL come from the persisted task and SHALL be formatted for the user's locale, while each value SHALL also remain machine-readable through a `<time>` element carrying the original ISO 8601 UTC value. The fields SHALL NOT be editable. The creation dialog SHALL NOT show timestamp metadata because the task does not exist yet. After any successful task modification, reopening the task SHALL show the unchanged creation time and the latest update time.

#### Scenario: Edit dialog shows both timestamps

- **WHEN** the user opens an existing task
- **THEN** the dialog shows labelled creation and last-updated values with readable local formatting and machine-readable `datetime` attributes

#### Scenario: Timestamps are read-only

- **WHEN** the user edits and saves other task fields
- **THEN** the dialog offers no input for the timestamps and does not submit client-calculated timestamp values

#### Scenario: Creation dialog has no timestamps

- **WHEN** the user opens the dialog to create a new task
- **THEN** no creation or last-updated metadata is displayed before the task is saved

#### Scenario: Updated time reflects the latest modification

- **WHEN** a task is updated, moved, reordered or has a checklist changed and the user reopens it
- **THEN** the last-updated value reflects the latest persisted modification and the creation value is unchanged

#### Scenario: Theme and accessibility

- **WHEN** the user switches between light, dark and high-contrast themes
- **THEN** the timestamp metadata remains readable and uses theme-provided colors and labels

### Requirement: Shared themed visual system

The interface SHALL use one visual system across the board and the task dialog, built from theme-derived surface layers, quiet borders, consistent corner radii, a compact typography scale and a consistent spacing rhythm. The board background, column surface, card surface, input surface and dialog surface SHALL be visually distinguishable layers rather than a single flat background. Priority treatments SHALL pair color with a readable text label, and tag treatments SHALL pair color with an icon and text label. Hover, focus, drag and disabled states SHALL use the same visual language throughout.

#### Scenario: Layered dark theme

- **WHEN** the board is displayed in a dark VS Code theme
- **THEN** the board, columns, cards, inputs and dialog use distinct layered surfaces with quiet borders and readable contrast

#### Scenario: Light and high-contrast themes

- **WHEN** the user switches to a light or high-contrast theme
- **THEN** the same hierarchy remains readable, borders remain visible and no element relies on a dark-only color

#### Scenario: Priority is not color-only

- **WHEN** a task has low, medium or high priority
- **THEN** the badge shows a tinted color treatment and the readable priority label

#### Scenario: Tag is not color-only

- **WHEN** a task has tags
- **THEN** each tag chip shows its icon and text label with a neutral chip surface, and selection states add a fill or check mark rather than changing color alone

#### Scenario: Keyboard focus remains visible

- **WHEN** the user navigates with the keyboard
- **THEN** every interactive element shows a clear focus indicator consistent with the theme

### Requirement: Board and column presentation

The board SHALL present its header as a compact toolbar with the board identity and summary on the left and grouped actions on the right. Columns SHALL render as layered panels with a colored status dot, the column title, a count pill and a header add action. A full-width add-task affordance SHALL appear at the top of each column's task list. Column reorder, edit and delete actions SHALL remain available but visually quiet until hover or keyboard focus.

#### Scenario: Column identity and count

- **WHEN** a column is displayed
- **THEN** its header shows the status dot, title and a count pill matching the number of tasks

#### Scenario: Add task at the top of the column

- **WHEN** the user views a column
- **THEN** an add-task row is visible at the top of the task list and is reachable by keyboard

#### Scenario: Quiet column actions

- **WHEN** the user is not hovering or focusing a column header
- **THEN** the reorder, edit and delete actions are visually subdued but still present and accessible

#### Scenario: Empty column

- **WHEN** a column has no tasks
- **THEN** the column shows a calm empty state that preserves the column height and the add-task affordance

#### Scenario: Narrow board

- **WHEN** the board is narrower than its columns
- **THEN** columns keep their width and the board scrolls horizontally without clipping card content

### Requirement: Task card visual hierarchy

Each task card SHALL present a compact metadata row, a prominent title, an optional description preview, neutral tag chips and a footer with checklist progress and last-updated metadata. The priority badge SHALL sit at the top right. Cards SHALL use the layered card surface, quiet border and consistent radius, with hover and drag states that do not shift surrounding layout. Long titles and descriptions SHALL wrap or truncate without breaking the card.

#### Scenario: Card hierarchy

- **WHEN** a task with priority, tags, a description, checklists and timestamps is displayed
- **THEN** the priority badge, title, description preview, tag chips and footer metadata are visually distinct and easy to scan

#### Scenario: Card without optional data

- **WHEN** a task has no description, tags or checklists
- **THEN** the card still renders a balanced layout without empty metadata placeholders

#### Scenario: Hover and drag states

- **WHEN** the user hovers over or drags a card
- **THEN** the card shows a subtle surface change and drag affordance without changing its size or moving neighbouring cards

#### Scenario: Updated metadata

- **WHEN** a task has an `updatedAt` timestamp
- **THEN** the card footer shows a readable last-updated value alongside checklist progress when present

### Requirement: Task dialog visual consistency

The task dialog SHALL use the same visual system as the board. It SHALL open as a wide, elevated surface with a header containing the task context and priority badge, a read-only metadata strip for creation and last-updated timestamps, and grouped Details, Organization and Checklists sections. Inputs, tag chips, priority badges and buttons SHALL match the board. The footer SHALL remain visible while long content scrolls, and the dialog SHALL preserve its existing focus management and keyboard behavior.

#### Scenario: Dialog header and metadata

- **WHEN** an existing task is opened
- **THEN** the dialog shows a clear header with the task context, the priority badge and a compact created/last-updated metadata strip

#### Scenario: Grouped form sections

- **WHEN** the dialog is displayed
- **THEN** title and description, column/priority/tags, and checklists are grouped into visually distinct sections with consistent spacing

#### Scenario: Matching chips and controls

- **WHEN** the user selects tags or views priorities in the dialog
- **THEN** the chips, badges, inputs and buttons use the same visual language as the corresponding board elements

#### Scenario: Long content

- **WHEN** a task has enough fields or checklist items to exceed the viewport
- **THEN** the dialog body scrolls while the header and footer remain visible

#### Scenario: Theme and accessibility preserved

- **WHEN** the user changes the theme or navigates the dialog with a keyboard
- **THEN** contrast, focus indicators, focus trapping and Escape-to-close behavior remain intact

### Requirement: Card density preference

The board SHALL offer a card density control with `expanded` and `compact` layouts. `expanded` SHALL be the default and SHALL preserve the complete card presentation. `compact` SHALL show only the task title, a priority icon, checklist progress and tag icons, omitting the description preview, tag text labels and last-updated metadata. The selected density SHALL be persisted and restored for the workspace, SHALL apply to every card at once, and SHALL remain switchable without reloading the board. Both densities SHALL keep the card's edit, delete and move actions reachable by pointer and keyboard.

#### Scenario: Switch to compact

- **WHEN** the user selects the compact density
- **THEN** every card immediately shows only the title, priority icon, checklist progress and tag icons

#### Scenario: Switch back to expanded

- **WHEN** the user selects the expanded density
- **THEN** descriptions, tag labels and last-updated metadata reappear without changing the board data

#### Scenario: Density persists

- **WHEN** the user reloads or reopens the board after choosing compact
- **THEN** the board restores the compact density for that workspace

#### Scenario: Default density

- **WHEN** the workspace has no saved density preference
- **THEN** the board uses the expanded density

#### Scenario: Compact cards remain usable

- **WHEN** a task is displayed in compact density and the user hovers, focuses or navigates to it with the keyboard
- **THEN** the task can still be opened, deleted and moved, and the priority and tags expose accessible names despite their icon-only presentation

### Requirement: Checklist progress display

For a task with checklists, the card SHALL show derived checklist progress as a checklist icon, a `completed/total` count and a proportional progress bar. The progress bar SHALL convey its value to assistive technology and SHALL NOT be the only indicator of progress. The progress SHALL be computed from checklist item state and SHALL NOT be persisted as a separate counter.

#### Scenario: Partial progress

- **WHEN** a task has checklists with three completed items out of five
- **THEN** the card shows `3/5` and a progress bar filled to three fifths

#### Scenario: Complete progress

- **WHEN** every checklist item is complete
- **THEN** the card shows the full count with a fully filled progress bar and the complete state is announced accessibly

#### Scenario: No checklists

- **WHEN** a task has no checklists or no checklist items
- **THEN** the card does not show a checklist progress element

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
