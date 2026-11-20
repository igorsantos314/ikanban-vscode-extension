# Spec Delta

## Purpose

Defines a file-backed, per-column pagination index and cursor so large boards can load tasks in pages without reading every task YAML up front, while keeping the task files as the only source of truth.

## ADDED Requirements

### Requirement: Derived per-column task index

The extension SHALL maintain a derived index for each column at `.ikanban/.index/<column-id>.json`. The index SHALL contain a version, the column ID, a tasks revision and the ordered entries for that column, where each entry records the task ID, its `position`, its file name, size and modification time. The index SHALL be derived data: task YAML files remain the authoritative source for task content, and deleting the index directory SHALL lose no board data. Index writes SHALL be atomic and SHALL NOT modify any task file.

#### Scenario: Index is created for a column

- **WHEN** a column is loaded for the first time and has task files
- **THEN** `.ikanban/.index/<column-id>.json` contains the ordered entries and a tasks revision

#### Scenario: Index is derived, not authoritative

- **WHEN** the index is deleted while the task files remain
- **THEN** the column still loads correctly after rebuilding the index from the task files

#### Scenario: Index never rewrites task content

- **WHEN** the extension writes or repairs an index
- **THEN** every task YAML remains byte-for-byte unchanged

### Requirement: Self-repairing index

Before serving a page, the extension SHALL compare the index with the actual column directory entries. If the index is missing, unreadable, corrupt, references a file that no longer exists, has a different size or modification time for a file, or omits a file present in the directory, the extension SHALL rebuild the index from the task files in that column. A rebuilt index SHALL produce a new tasks revision and SHALL NOT include invalid task files as valid entries.

#### Scenario: Missing index

- **WHEN** a column has task files but no index
- **THEN** the index is rebuilt before the first page is returned

#### Scenario: Stale index after external edit

- **WHEN** a task file's content or modification time changes outside iKanban
- **THEN** the index is detected as stale and rebuilt for that column

#### Scenario: Corrupt index

- **WHEN** the index JSON is malformed
- **THEN** the extension ignores it, rebuilds from the task files and continues serving pages

#### Scenario: Invalid task file is excluded

- **WHEN** a file in the column is invalid YAML or fails schema validation during rebuild
- **THEN** it is diagnosed and omitted from the index and from subsequent pages

### Requirement: Page cursor and deterministic ordering

Pages SHALL be ordered by ascending `position` with `taskId` as the deterministic tie-breaker. A column cursor SHALL identify the last loaded entry as `position` plus `taskId`. A page request SHALL return at most the requested page size of entries strictly after that cursor in the same order. The first page SHALL use no cursor. A response SHALL include the next cursor when more entries remain, whether more entries exist and the full column task count.

#### Scenario: First page

- **WHEN** a column with more than one page is loaded
- **THEN** the first page returns the first 20 valid tasks by `(position, taskId)` and a next cursor

#### Scenario: Next page continues after the cursor

- **WHEN** the client requests the next page with the last page's cursor
- **THEN** the response starts strictly after that `(position, taskId)` entry and does not repeat the task

#### Scenario: Equal positions use the task ID tie-breaker

- **WHEN** several tasks share the same `position`
- **THEN** they are ordered deterministically by task ID and pagination does not skip or duplicate them

#### Scenario: Last page

- **WHEN** the final page is returned
- **THEN** `hasMore` is false and the next cursor is absent or empty

#### Scenario: Count is full column count

- **WHEN** only the first page is loaded
- **THEN** the column still reports the total number of valid tasks in that column

### Requirement: Revisions and stale cursors

Each column response SHALL include a tasks revision that changes when the index's ordered entries or task file metadata change. The client SHALL send the revision it is paging. If the revision or cursor no longer matches the current column, the request SHALL be rejected with a structured conflict instead of returning a page from a moved cursor.

#### Scenario: Revision unchanged

- **WHEN** the column has not changed since the previous page
- **THEN** the next page request succeeds with the same revision

#### Scenario: Revision changed

- **WHEN** the column's task set or file metadata changed after the client received its revision
- **THEN** the page request fails with a conflict and the client resets that column to the first page

#### Scenario: Cursor task removed

- **WHEN** the task identified by the cursor no longer exists in the index
- **THEN** the request is rejected as a conflict rather than guessing a position

### Requirement: Page requests read only the requested tasks

A successful page request SHALL read and parse only the task files selected for that page. It SHALL NOT read the bodies of other task files to answer the request, except when rebuilding a stale index.

#### Scenario: Large column page

- **WHEN** a column has 500 tasks and the client requests page 3
- **THEN** the extension reads the index and only the files belonging to page 3

#### Scenario: Rebuild is the only full-column read

- **WHEN** the index is valid
- **THEN** serving pages does not read task files outside the requested page
