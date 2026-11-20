# Spec Delta

## ADDED Requirements

### Requirement: Paginated board snapshot and task page protocol

The host SHALL return only the first page of each column in the initial board snapshot. Each column view SHALL include its full task count, loaded count, tasks revision, next cursor and whether more pages exist. The typed webview protocol SHALL include a `task/page` request whose payload carries the column ID, an optional `(position, taskId)` cursor, the expected tasks revision and an optional page size. Its response SHALL include the page tasks, the next cursor, `hasMore`, the full task count and the tasks revision.

The host SHALL serve the page from that column's derived index and SHALL read only the task files in the requested page when the index is valid. A missing or stale revision, or a cursor whose task no longer exists, SHALL return a structured conflict error. Invalid task files encountered in the requested page SHALL be reported as diagnostics and omitted from the returned tasks without failing the whole page.

#### Scenario: Initial snapshot is paginated

- **WHEN** the webview loads a board whose columns have more than 20 tasks
- **THEN** each column includes only its first 20 tasks plus pagination metadata and the full count

#### Scenario: Page request succeeds

- **WHEN** the webview sends `task/page` with a valid cursor and matching tasks revision
- **THEN** the host returns the next page, next cursor and revision

#### Scenario: Stale page request conflicts

- **WHEN** the webview sends a page request with an outdated tasks revision
- **THEN** the host returns a conflict error and no page

#### Scenario: Invalid task in a page

- **WHEN** a task file in the requested page is invalid
- **THEN** the host reports the diagnostic, omits that task from the page and still returns the other valid tasks

#### Scenario: Missing index is rebuilt before serving

- **WHEN** the index is missing or stale on a page request
- **THEN** the host rebuilds it before selecting and reading the page

### Requirement: External changes invalidate column pages

The existing filesystem watcher SHALL invalidate the affected column's index when a task file changes, is created or is deleted. The host SHALL push an updated board snapshot that resets the affected column to its first page with a new tasks revision, while other columns keep their current pagination metadata. The webview SHALL resolve any in-flight page request for that column as stale and replace it with the reset page.

#### Scenario: Task file edited externally

- **WHEN** a task file in one column changes outside iKanban
- **THEN** that column's index is invalidated and its first page is pushed with a new revision

#### Scenario: Other columns keep their pages

- **WHEN** one column resets after an external change
- **THEN** the other columns keep their loaded tasks and cursors

#### Scenario: In-flight page becomes stale

- **WHEN** an external change arrives while a page request for that column is in flight
- **THEN** the stale response is not appended and the column uses the reset snapshot

#### Scenario: Own write does not cause a page reset loop

- **WHEN** the extension persists its own task change
- **THEN** its own watcher event does not trigger a redundant reset beyond the authoritative post-write snapshot
