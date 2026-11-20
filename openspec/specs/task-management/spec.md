# task-management Specification

## Purpose

Defines the task lifecycle on a local Kanban board: independent YAML task files, editable task fields, visual tags, deterministic ordering, and safe movement between columns.

## Requirements

### Requirement: Task creation

The extension SHALL create a task only when the request contains a non-empty trimmed title and an existing target column. A task SHALL have a generated stable UUID, the containing column, a priority of `low`, `medium` or `high`, an optional description, a tags array, a non-negative integer position, `createdAt` and `updatedAt` timestamps, zero or more embedded checklists and an optional deadline. The extension SHALL write the task to `<task-id>.yaml` inside the target column directory, SHALL NOT create a task status field, and SHALL NOT create a file when validation or persistence fails. A newly created task SHALL be appended after the existing tasks in its column.

#### Scenario: Create a valid task

- **WHEN** the user creates a task titled `Implement authentication` in `backlog` with priority `high` and tags `feat`, `spec`
- **THEN** a new `<uuid>.yaml` exists in `.ikanban/backlog` with the title, priority, tags, timestamps and an appended position

#### Scenario: Create a task with a deadline

- **WHEN** the user creates a task and fills both the `DD/MM/AAAA` date and `HH:MM` time fields
- **THEN** the YAML contains one ISO 8601 UTC `dueAt` timestamp equivalent to the entered local date and time

#### Scenario: Create a task without a deadline

- **WHEN** the user creates a task and leaves the deadline empty
- **THEN** the task is valid and no `dueAt` field is written

#### Scenario: Title is required

- **WHEN** the user submits a task with a blank or whitespace-only title
- **THEN** the operation fails with a message that the task title is required and no file is created

#### Scenario: Target column must exist

- **WHEN** the user submits a task for a column that is no longer present
- **THEN** the operation fails with a message that the selected column no longer exists and no file is created

#### Scenario: New task does not modify siblings

- **WHEN** a task is created in a column that already contains tasks
- **THEN** only the new task file and the board state are changed, and existing task files are untouched

### Requirement: Task reading and identity

Each task SHALL be identified by a stable UUID that does not change across edits or column moves. The task file name SHALL be the task ID followed by `.yaml`. Task IDs SHALL be unique across the entire board. A task SHALL belong to the column directory that contains its file. When a task file is invalid, the extension SHALL report a diagnostic and omit that task from the board while preserving access to all valid tasks.

#### Scenario: Reload a persisted task

- **WHEN** a board is reopened after a task was created
- **THEN** the task is loaded with the same ID, fields and position

#### Scenario: File name must match ID

- **WHEN** the file `other-name.yaml` contains a task whose `id` is different
- **THEN** validation reports a task identity mismatch for that file

#### Scenario: Duplicate task IDs across files

- **WHEN** two task files in the board declare the same task ID
- **THEN** validation reports the duplicate task ID and neither duplicate is silently presented as authoritative

#### Scenario: Invalid file does not hide valid tasks

- **WHEN** one task file is malformed while other task files are valid
- **THEN** the valid tasks remain visible and the malformed file is reported as invalid

### Requirement: Task update

The extension SHALL allow a task's title, description, priority, tags, embedded checklists and deadline to be updated. Updates SHALL verify the task still exists and that its current revision matches the revision the user loaded, SHALL validate the resulting document, and SHALL update `updatedAt`. Updates SHALL preserve the task ID, `createdAt`, column membership and position unless the request explicitly moves, reorders or reschedules the task. Clearing the deadline SHALL remove it rather than substitute a default. A failed update SHALL leave the task file unchanged and SHALL NOT modify unrelated tasks.

#### Scenario: Update title and description

- **WHEN** the user edits a task title and multiline description and saves
- **THEN** the YAML file contains the new values and the task ID and `createdAt` are unchanged

#### Scenario: Change priority

- **WHEN** the user changes a task priority from `medium` to `high`
- **THEN** the persisted task has priority `high`

#### Scenario: Add and remove tags

- **WHEN** the user selects `chore` and deselects `feat`
- **THEN** the persisted tags contain `chore` and do not contain `feat`

#### Scenario: Change the deadline

- **WHEN** the user changes the local date or time of an existing deadline and saves
- **THEN** the persisted `dueAt` is replaced with the new ISO 8601 UTC timestamp

#### Scenario: Clear the deadline

- **WHEN** the user clears an existing deadline and saves
- **THEN** the persisted task has no `dueAt` field and all other fields remain unchanged

#### Scenario: Reject a partial deadline

- **WHEN** the user supplies only a date or only a time for the deadline and saves
- **THEN** the operation fails validation and the original task file remains unchanged

#### Scenario: Update nonexistent task

- **WHEN** the user tries to update a task that has been deleted
- **THEN** the operation fails with a not-found message and no file is created

#### Scenario: Invalid update is atomic

- **WHEN** a task update fails validation
- **THEN** the original YAML document remains byte-for-byte unchanged

### Requirement: Task deletion

The extension SHALL allow a task to be deleted after user confirmation. Deleting a task SHALL remove only its YAML file and SHALL NOT modify other tasks or columns. Deleting a nonexistent task SHALL fail with a not-found error.

#### Scenario: Delete a task

- **WHEN** the user confirms deletion of a task
- **THEN** its YAML file is removed and the task no longer appears on the board

#### Scenario: Deletion leaves siblings untouched

- **WHEN** one task is deleted from a column containing other tasks
- **THEN** every other task file remains unchanged

#### Scenario: Delete nonexistent task

- **WHEN** a delete request targets a task ID that does not exist
- **THEN** the operation fails with a not-found message

### Requirement: Task movement between columns

The extension SHALL move a task between columns by moving its YAML file from the source column directory to the target column directory. Movement SHALL preserve the task ID, title, description, tags, priority, checklists, checklist item completion states, deadline and `createdAt`. Movement SHALL recalculate the task position for the target column and SHALL update `updatedAt`. The source and target columns SHALL be existing, distinct columns. The operation SHALL NOT overwrite an existing task file. If the move cannot be completed, the task SHALL remain in exactly one column.

#### Scenario: Move a task

- **WHEN** the user drags a task from `backlog` to `in-progress`
- **THEN** the task file is removed from `.ikanban/backlog` and created in `.ikanban/in-progress` with the same ID and content aside from position and `updatedAt`

#### Scenario: Movement preserves checklists

- **WHEN** a task with completed and incomplete checklist items is moved
- **THEN** every checklist, item text and completion state is preserved

#### Scenario: Movement preserves the deadline

- **WHEN** a task with a deadline is moved to another column
- **THEN** its `dueAt` value is byte-for-byte equivalent after the move

#### Scenario: Movement during reorder preserves the deadline

- **WHEN** a task with a deadline is reordered within its column
- **THEN** its `dueAt` value remains unchanged

#### Scenario: Movement reloads correctly

- **WHEN** the extension or repository is restarted after a move
- **THEN** the task is loaded only from the target column with the expected data

#### Scenario: Target collision rejected

- **WHEN** the target column already contains a file for the same task ID
- **THEN** the move is rejected without overwriting either file

#### Scenario: Move failure leaves one copy

- **WHEN** persistence fails partway through a move
- **THEN** the task remains in exactly one column and a storage error is reported

### Requirement: Deterministic task ordering

Tasks SHALL be ordered within a column by ascending `position`, with the task ID as a deterministic tie-breaker. New tasks SHALL receive a position greater than the current maximum in the column. Reordering or inserting a task SHALL use a spaced position between its neighbors. When no sufficient gap remains, the extension SHALL rebalance positions in that column only, using consistent spacing, and SHALL NOT rewrite tasks in other columns.

#### Scenario: Reorder within a column

- **WHEN** the user drops a task between two other tasks
- **THEN** its position lies between their positions and the order is exactly the requested order

#### Scenario: Position gap exhausted

- **WHEN** no integer gap remains between adjacent task positions
- **THEN** the affected column's task positions are rebalanced deterministically and the requested order is preserved

#### Scenario: Rebalance is column-local

- **WHEN** positions are rebalanced in one column
- **THEN** no task file in another column is modified

#### Scenario: Stable ordering after reload

- **WHEN** a board with equal task positions is loaded
- **THEN** tasks are ordered deterministically by position and then ID

### Requirement: Task classification tags

A task SHALL support multiple tags from the fixed set `issue`, `feat`, `chore` and `spec`. Tags SHALL be persisted as an array of canonical string identifiers. Unknown tags SHALL produce a meaningful validation error. Duplicate tags in one task SHALL be rejected. Persisted tag ordering SHALL be deterministic using the canonical order `issue`, `feat`, `chore`, `spec`. The tag definitions SHALL be centralized so labels, icons and colors are consistent across the interface.

#### Scenario: Multiple tags persist

- **WHEN** a task is saved with `spec` and `issue`
- **THEN** the YAML contains both canonical identifiers in canonical order

#### Scenario: Unknown tag is invalid

- **WHEN** a task file contains `tags: [urgent]`
- **THEN** validation reports an unsupported tag for that task

#### Scenario: Duplicate tags are invalid

- **WHEN** a task file contains the same tag twice
- **THEN** validation reports the duplicate tag instead of silently deduplicating it

#### Scenario: Canonical order is written deterministically

- **WHEN** the same logical set of tags is saved twice in different selection orders
- **THEN** both persisted arrays have the same canonical order

### Requirement: Priority and timestamps

A task priority SHALL be exactly one of `low`, `medium` or `high`. Every task SHALL have `createdAt` and `updatedAt` timestamps using a consistent ISO 8601 UTC representation. `createdAt` SHALL remain unchanged after creation. `updatedAt` SHALL change on every successful task modification, including moves, reorders and checklist changes.

#### Scenario: Invalid priority rejected

- **WHEN** a task file contains `priority: urgent`
- **THEN** validation reports an unsupported priority

#### Scenario: Created timestamp is stable

- **WHEN** a task is edited several times
- **THEN** `createdAt` keeps its original value and `updatedAt` reflects the latest modification

#### Scenario: Timestamps are consistent

- **WHEN** any task is persisted
- **THEN** both timestamps use the same ISO 8601 UTC format and parse to valid instants

### Requirement: Optional text and safe rendering

A task description SHALL be optional and MAY be empty or multiline. Task titles, descriptions, tag labels and checklist text SHALL be rendered as text, never as untrusted HTML. Long descriptions, Markdown-looking content and HTML-like content SHALL be preserved faithfully in YAML and displayed without execution.

#### Scenario: Empty description allowed

- **WHEN** a task is created with an empty description
- **THEN** the task is valid and the description may be persisted as an empty value

#### Scenario: HTML-like description is inert

- **WHEN** a description contains `<script>alert(1)</script>`
- **THEN** the text is stored unchanged and displayed without executing script

### Requirement: Task deadline

A task SHALL support one optional deadline stored as a `dueAt` ISO 8601 UTC timestamp. A deadline SHALL consist of both a calendar date and a time of day; a date without a time or a time without a date SHALL NOT be persisted. The interface SHALL edit the deadline in the user's local timezone through masked fields and SHALL convert it to UTC for storage, so the same instant is preserved across timezones. The deadline SHALL be optional and SHALL be removed only by an explicit clear action. Deadline status SHALL be derived from the current time and SHALL NOT be stored as a separate field.

#### Scenario: Deadline stores an instant

- **WHEN** a workspace task is created with a local deadline
- **THEN** the persisted `dueAt` is an ISO 8601 UTC timestamp representing that same instant

#### Scenario: Deadline converts back to local time

- **WHEN** the task is reloaded in the same timezone
- **THEN** the dialog shows the original local date and time

#### Scenario: Deadline is optional

- **WHEN** no deadline is set
- **THEN** the task is valid and deadline-related UI is omitted from its card

#### Scenario: Partial deadline is never persisted

- **WHEN** a request contains a date without a time or a time without a date
- **THEN** the operation is rejected and no task file is written or modified

#### Scenario: Overdue is derived

- **WHEN** the current time passes a task's deadline
- **THEN** the interface marks the task as overdue without rewriting the task file

#### Scenario: Clearing removes the field

- **WHEN** the user clears a deadline
- **THEN** the `dueAt` key is removed from the task document and no null placeholder is persisted
