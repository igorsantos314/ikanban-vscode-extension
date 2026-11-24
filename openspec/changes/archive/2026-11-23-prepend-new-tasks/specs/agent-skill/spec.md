# Spec Delta

## MODIFIED Requirements

### Requirement: Agent task operations

The skill SHALL instruct agents to read `.ikanban/board.yaml` before acting and to use only existing column directories. For task creation, the agent SHALL generate a stable UUID, write `<task-id>.yaml` inside the target column directory, set `createdAt` and `updatedAt` to the same current UTC timestamp, assign the greatest non-negative position lower than the current minimum in that column (or `1024` when the column is empty), use only canonical tags and a valid priority, and embed checklists with UUID identifiers and positions. When the current minimum position is `0`, the agent SHALL rebalance the target column locally so the new task is first while preserving the existing relative order. A task document SHALL NOT contain a status or column field. For updates, the agent SHALL preserve the task ID, `createdAt`, column membership and position unless the request explicitly moves or reorders it, and SHALL update `updatedAt`. For moves, the agent SHALL move the YAML file between existing column directories, recalculate the target position and update `updatedAt` while preserving every other field. For reordering, the agent SHALL assign spaced positions and update `updatedAt` for each task whose position changes. For deletion, the agent SHALL remove only the requested task file.

#### Scenario: Add a task to the backlog

- **WHEN** an agent adds a task to `backlog`
- **THEN** a new `<uuid>.yaml` exists in `.ikanban/backlog` with equal `createdAt` and `updatedAt`, a position before the existing tasks, canonical tags and a valid checklist structure

#### Scenario: New task is first in the column

- **WHEN** an agent adds a task to a non-empty column
- **THEN** the new task is ordered before every existing task in that column

#### Scenario: Prepend when no position remains

- **WHEN** the first task in the target column already has position `0`
- **THEN** the agent rebalances that column locally, places the new task first and preserves the relative order of existing tasks

#### Scenario: Update a task

- **WHEN** an agent changes a task title or description
- **THEN** the task ID, `createdAt`, column and position are preserved and `updatedAt` reflects the change

#### Scenario: Move a task to another column

- **WHEN** an agent moves a task from `backlog` to `in-progress`
- **THEN** the file is removed from the source directory, written to the target directory with the same ID and `createdAt`, a recalculated position and an updated `updatedAt`

#### Scenario: Reorder within a column

- **WHEN** an agent moves a task between two tasks in the same column
- **THEN** its position lies between its neighbors, or the affected column is rebalanced with spaced positions, and the changed tasks receive an updated `updatedAt`

#### Scenario: Remove a task

- **WHEN** an agent deletes a task
- **THEN** only that task's YAML file is removed and sibling tasks and column files are untouched

#### Scenario: Preserve unknown fields

- **WHEN** a task document contains fields the skill does not recognize
- **THEN** the agent preserves them when editing the document
