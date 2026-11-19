# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
