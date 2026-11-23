# Proposal

## Why

New tasks currently receive the highest position in their column, so they appear at the bottom of the list. On boards with long columns or paginated feeds, a task created from the board or the Command Palette can be immediately out of view, forcing the user to scroll or load more pages to find it. New work should be visible first.

## What Changes

- Change task creation to assign the new task a position before the current first task in its column instead of after the current maximum.
- Preserve deterministic ordering and column-local position maintenance when no gap remains above the first task.
- Apply the new ordering to every task creation path exposed by the extension: the task dialog, `Add task`, and `iKanban: Create New Task`.
- Update the bundled AI skill so agents following the documented creation flow also prepend new tasks.
- Update the README and skill documentation to describe the prepend behavior.
- Manual YAML editing remains free to choose any valid position; the requirement applies to tasks created through iKanban's creation flows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-management`: Task creation and deterministic ordering change so new tasks are inserted before existing tasks instead of appended.
- `agent-skill`: The skill's task-creation instructions and example requirement change from assigning `max + 1024` to prepending before the current first position.
- `vscode-integration`: The `ikanban.createTask` command requirement changes from appending the task to prepending it.

## Impact

- `BoardService.createTask` and the position helpers used for column ordering.
- Unit tests for task creation, pagination first-page contents and the create-task command.
- `resources/skills/ikanban/SKILL.md` and `README.md`.
- No task YAML schema change, no migration and no change to existing persisted tasks.
