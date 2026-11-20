# Spec Delta

## ADDED Requirements

### Requirement: Paginated column feed

Each column SHALL display its first task page immediately and load subsequent pages when the user reaches the bottom of that column's task list. Loading SHALL be per column and SHALL NOT block other columns. The interface SHALL place an observable sentinel at the end of the loaded tasks; when it becomes visible, the next page SHALL be requested if one exists. A visible **Load more** action SHALL remain available for keyboard and assistive-technology users and where intersection observation is unavailable.

While a page is loading, the column SHALL show a loading state and SHALL NOT issue duplicate requests for the same cursor. When the last page is loaded, the column SHALL show a stable end-of-list state without a Load more action. A failed page load SHALL keep the already loaded tasks visible and offer retry.

When a column's tasks revision changes because of an external file change or a conflicting cursor, that column SHALL reset to its first page and reload. Other columns SHALL keep their loaded pages and scroll positions. The column count SHALL always reflect the full number of tasks, not only the loaded ones.

#### Scenario: First page renders

- **WHEN** a column with more than 20 tasks opens
- **THEN** the first 20 tasks render immediately

#### Scenario: Scroll to bottom loads more

- **WHEN** the user scrolls to the end of a column that has more tasks
- **THEN** the next page is requested and appended in cursor order

#### Scenario: Load more fallback

- **WHEN** the user activates the visible Load more action
- **THEN** the next page is requested without requiring pointer scrolling

#### Scenario: Loading state and no duplicates

- **WHEN** a page request is already in flight for a column
- **THEN** no second request is sent for that column and a loading indicator is visible

#### Scenario: End of list

- **WHEN** the last page is loaded
- **THEN** the column shows that there are no more tasks and no longer offers Load more

#### Scenario: Page failure keeps loaded tasks

- **WHEN** a page request fails
- **THEN** the already loaded tasks remain visible, an error is shown and retry is available

#### Scenario: External change resets one column

- **WHEN** a file in a column changes externally
- **THEN** that column resets to its first page while other columns preserve their pages

#### Scenario: Full count with partial tasks

- **WHEN** 100 tasks exist but only 20 are loaded
- **THEN** the column header count displays 100

### Requirement: Drag and move with partially loaded columns

Task drag-and-drop and keyboard movement SHALL remain correct when a column has unloaded pages. Dropping on the column's end SHALL append at the full task count, not at the loaded count. Dropping over a loaded task SHALL place the task relative to loaded neighbors while leaving unloaded tasks after them unchanged. Moving or reordering a task SHALL NOT require loading every task in the target column, and the affected columns SHALL reflect the authoritative result and current pagination cursor.

#### Scenario: Drop at the end of a partially loaded column

- **WHEN** a column has 100 tasks and only 20 loaded, and the user drops a card at the end
- **THEN** the task is appended after task 100 rather than after task 20

#### Scenario: Drop over a loaded task

- **WHEN** the user drops a task over a loaded task in a partially loaded column
- **THEN** the order changes relative to the loaded tasks and unloaded tasks keep their relative order after them

#### Scenario: Keyboard move to a partially loaded column

- **WHEN** the user moves a task with `Alt+Arrow` to an adjacent column that has unloaded tasks
- **THEN** the task is appended at the full column count

#### Scenario: Move result refreshes pages

- **WHEN** a move or reorder succeeds
- **THEN** the affected columns show the authoritative order and a cursor consistent with the new revision
