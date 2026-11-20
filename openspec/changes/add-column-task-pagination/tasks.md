# Tasks

## 1. Derived index and cursor

- [x] 1.1 Define index types and a versioned JSON codec for `.ikanban/.index/<column-id>.json`, including ordered entries, task metadata and `tasksRevision`; verify round-trip, invalid JSON rejection and version handling in unit tests.
- [x] 1.2 Add an atomic index store using the existing temp-file/rename pattern, with paths under `.ikanban/.index/`, no YAML discovery and safe delete behavior; verify writes do not touch task files and deleting the index is safe.
- [x] 1.3 Implement `TaskIndexService.ensureColumnIndex`: compare directory names, size and mtime with the index, rebuild when missing/corrupt/stale, sort by `(position, taskId)`, diagnose invalid files and exclude them; verify each repair case with real filesystem tests.
- [x] 1.4 Implement page selection helpers for the `(position, taskId)` cursor, limit clamping, `hasMore`, `nextCursor`, full count and revision hashing; verify first/middle/last pages, equal positions and cursor conflicts are not skipped or duplicated.
- [x] 1.5 Ensure page reads validate only the selected page files and rebuild/retry once if a file became invalid after indexing; verify a spy proves unloaded files are not read when the index is valid.

## 2. Host snapshot and protocol

- [x] 2.1 Extend `BoardSnapshot`/`ColumnView` with first-page metadata (`tasksRevision`, `nextCursor`, `hasMore`, `loadedCount`) while keeping full `taskCount`; verify the initial `board/load` returns at most 20 tasks per column and correct metadata.
- [x] 2.2 Add the `task/page` protocol request/response schema with column ID, cursor, expected revision and page size; validate malformed payloads and stale revisions in protocol/router tests.
- [x] 2.3 Implement `BoardService.loadTaskPage`, returning page tasks, next cursor, `hasMore`, full count and revision, and mapping missing/stale revision or cursor to a structured conflict; verify success, conflict and invalid-task scenarios.
- [x] 2.4 Update task create/update/delete index maintenance and keep `TaskView` responses; update move/reorder/column mutations to return a paginated first-page snapshot; verify mutations still refresh the affected indexes and counts.

## 3. Webview paginated state and infinite scroll

- [x] 3.1 Refactor `boardState` to store `tasksByColumn` plus per-column pagination state (cursor, revision, hasMore, status, requested cursor); verify snapshot replacement, merge-by-revision and page append/dedupe reducers.
- [x] 3.2 Add `task/page` loading to the board client/App with one in-flight request per column, stale-response rejection by revision and retry after failure; verify fake-client tests for success, duplicate request suppression, conflict and retry.
- [x] 3.3 Add the column sentinel with `IntersectionObserver`, a visible Load more fallback, loading/end/error rows and scroll preservation; verify automatic load, keyboard fallback, end state and retry in React tests.
- [x] 3.4 Render both card densities from the per-column loaded pages and keep the header count at the full task count; verify a partially loaded column shows 20 cards but the full count.

## 4. Partial-page interactions

- [x] 4.1 Update move-target computation to use loaded indexes plus full column counts, appending at the full count for column-end drops and keyboard moves; verify drop-at-end, drop-over-loaded-task and boundary cases.
- [x] 4.2 Update drag preview and post-move snapshots so affected columns reset to page 1 with a fresh cursor without disturbing other columns; verify App/useDragPreview tests with partial pages.
- [x] 4.3 Verify autosave and delete still update the correct loaded page/index entry, including tasks outside the first page.

## 5. Validation, watcher and reset

- [x] 5.1 Separate initial page validation from full-board validation: `loadBoard` validates only loaded pages, while `validateBoard` scans every task file and returns complete diagnostics with a paginated snapshot; verify a task invalid only outside loaded pages is reported by validate, not by initial load.
- [x] 5.2 Invalidate the affected column index from the watcher and push a paginated snapshot; verify only that column resets to page 1 while other columns keep their pages and stale in-flight pages are ignored.
- [x] 5.3 Ensure own writes remain self-write-suppressed and do not trigger redundant page resets; verify with watcher/service tests.

## 6. Documentation and verification

- [x] 6.1 Document `.ikanban/.index/`, its derived/git-ignored nature, cursor semantics and safe deletion in `README.md` and `AGENTS`/skill documentation; add `.ikanban/.index/` to `.gitignore`.
- [x] 6.2 Add tests for index repair, cursor ordering, revision conflicts, page I/O scoping, UI infinite scroll and partial drag, and update the extension-host suite for first-page load + page request.
- [x] 6.3 Run `npm run check` and fix all type, lint and unit failures.
- [x] 6.4 Run `npm run test:integration` and confirm the board opens with first pages, loads more, validates fully and survives external changes.
- [x] 6.5 Perform a final visual/manual pass with a large fixture board: automatic scroll loading, Load more fallback, end-of-list, retry, reset of one column and drag over loaded/unloaded ranges.
