# Spec Delta

## MODIFIED Requirements

### Requirement: Task creation

The extension SHALL create a task only when the request contains a non-empty trimmed title and an existing target column. A task SHALL have a generated stable UUID, the containing column, a priority of `low`, `medium` or `high`, an optional description, a tags array, a non-negative integer position, `createdAt` and `updatedAt` timestamps, zero or more embedded checklists and an optional deadline. The extension SHALL write the task to `<task-id>.yaml` inside the target column directory, SHALL NOT create a task status field, and SHALL NOT create a file when validation or persistence fails. A newly created task SHALL be placed before the existing tasks in its column: its position SHALL be the greatest non-negative integer lower than the current minimum position, or the default first position of `1024` when the column is empty. When the current minimum position is `0`, the extension SHALL rebalance that column locally so the new task receives the first position while existing tasks keep their relative order. Creating a task SHALL NOT modify sibling task files unless that column-local rebalance is required.

#### Scenario: Create a valid task

- **WHEN** the user creates a task titled `Implement authentication` in `backlog` with priority `high` and tags `feat`, `spec`
- **THEN** a new `<uuid>.yaml` exists in `.ikanban/backlog` with the title, priority, tags, timestamps and a position before the existing tasks

#### Scenario: New task appears first in a non-empty column

- **WHEN** a column already contains tasks and the user creates another task
- **THEN** the new task appears before every existing task in that column

#### Scenario: Create a task in an empty column

- **WHEN** the target column contains no tasks
- **THEN** the new task receives the first default position

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

- **WHEN** a task is created in a column that already contains tasks and a non-negative position exists before the current first task
- **THEN** only the new task file and the board state are changed, and existing task files remain unchanged

#### Scenario: Prepend rebalances when no position remains

- **WHEN** the current first task already has position `0` and a new task is created in that column
- **THEN** the column's existing task positions are rebalanced locally, the new task receives the first position, and their relative order is preserved

### Requirement: Deterministic task ordering

Tasks SHALL be ordered within a column by ascending `position`, with the task ID as a deterministic tie-breaker. New tasks SHALL receive the greatest non-negative integer position lower than the current minimum in the column, or `1024` when the column is empty. When the current minimum is `0`, the extension SHALL rebalance positions in that column to make room for the new task, preserving the existing relative order and assigning consistent spacing. Reordering or inserting an existing task SHALL use a spaced position between its neighbors. When no sufficient gap remains, the extension SHALL rebalance positions in that column only, using consistent spacing, and SHALL NOT rewrite tasks in other columns.

#### Scenario: New task is prepended

- **WHEN** a task is created in a column whose first task has a positive position
- **THEN** the new task is ordered before every existing task in that column

#### Scenario: Prepend rebalances the column

- **WHEN** a task is created while the first task in its column has position `0`
- **THEN** the affected column is rebalanced deterministically and the new task is first

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
