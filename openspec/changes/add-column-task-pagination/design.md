# Design

## Context

See `proposal.md` for motivation and the delta specs for the behavior contract.

- `BoardService.loadBoard()` currently lists every task file in every column and parses every task before returning `BoardSnapshot`. `BoardSnapshot.tasks` is a flat list used by the webview, drag helpers and mutations.
- Task files are named by UUID. Their order lives in the YAML `position` field, so file names cannot provide a page order.
- `BoardRepository.listTaskFiles` returns file references, and `WorkspaceFileSystem.stat` exposes size/mtime. Both can support an index without changing task storage.
- `BoardWatcher` already observes `.ikanban/**/*.yaml`, debounces and asks the panel to refresh. Own writes are suppressed through the write registry.
- Mutations return authoritative `TaskView` or `BoardSnapshot`; `moveTask` currently reads every task in the target column to compute positions.
- The webview stores a flat task list in `boardState`; `BoardColumn` owns the scroll container. Existing card/drag UX is complete and should stay.

## Goals / Non-Goals

**Goals:**

- First paint reads only the first page per column when a valid index exists.
- A stable `(position, taskId)` cursor plus tasks revision prevents skips, duplicates and stale appends.
- The index is derived, self-repairing and safe to delete.
- Pagination is invisible to normal card editing, dragging and validation semantics except where explicitly changed.

**Non-Goals:**

- Changing the task YAML format or adding required metadata to task files.
- Committing the index or using it as authoritative task content.
- Search/filter/virtual scrolling within a page.
- Paginating board or column configuration documents.
- Background indexing outside the extension host.

## Decisions

### 1. Persist one derived index per column as JSON

Layout: `.ikanban/.index/<column-id>.json`

```json
{
  "version": 1,
  "columnId": "backlog",
  "tasksRevision": "sha256-of-ordered-entries",
  "entries": [
    { "id": "...", "position": 1024, "fileName": "...yaml", "size": 420, "mtime": 1760000000000 }
  ]
}
```

- Entries are sorted by `(position, id)` and contain no task content.
- `tasksRevision` is a hash of the ordered `(id, position, size, mtime)` tuples. Any external edit that changes size/mtime changes the revision.
- Writes use the existing temp-file + rename pattern and never touch task files.
- `.ikanban/.index/` is added to `.gitignore` and documented as derived. The index is intentionally not named `.yaml` so the task watcher and task-file discovery ignore it.
- **Alternative considered**: one board-wide index. Rejected: a single file becomes large and every column edit invalidates the whole board index.
- **Alternative considered**: no index, read all files on every page. Rejected: defeats lazy loading.

### 2. Build, validate and repair the index in a dedicated service

Add an application-level `TaskIndexService` (infrastructure-backed) with:

- `ensureColumnIndex(columnId)`: read the index, list the column directory and stat each task file. Compare file names, size and mtime. If missing, corrupt, mismatched or containing an entry whose file disappeared, rebuild from task files.
- `rebuildColumnIndex(columnId)`: read every valid task file once, validate identity (`fileName === id.yaml`) and schema, sort by `(position, id)`, exclude invalid files with diagnostics, write the index atomically and compute the revision.
- `readPage(columnId, cursor, limit, expectedRevision)`: verify revision, select entries strictly after cursor, return the selected entries and `hasMore`.

Rules:

- The index never provides task content; page bodies always come from YAML files.
- A page read validates its files. If a selected file became invalid between index build and read, rebuild the column index once and retry the page from the fresh index rather than returning a corrupt entry.
- Reading the whole column is acceptable only while rebuilding a stale index.
- Deleting the index directory is safe; it rebuilds on demand.

### 3. Cursor and ordering

Order key: `(position ASC, taskId ASC)`, matching deterministic board ordering.

Cursor: `{ position: number, taskId: string }`.

Page selection:

```text
entry.position > cursor.position
OR (entry.position === cursor.position AND entry.id > cursor.taskId)
```

`limit` defaults to 20 and is clamped to a safe maximum. `nextCursor` is the last returned entry; `hasMore` is true when at least one further valid entry exists; `taskCount` is `entries.length`.

- The client sends the `tasksRevision` it last saw. A mismatch returns a structured `PaginationConflict`; the webview resets the column instead of appending a possibly duplicated page.
- A cursor whose task no longer exists is also a conflict, not a guessed position.

### 4. Board load returns first pages, page requests read only their slice

- `BoardSnapshot.tasks` contains the first page of each column.
- `ColumnView` gains `tasksRevision`, `nextCursor`, `hasMore` and `loadedCount`; `taskCount` remains the full valid count.
- `loadBoard()` reads board/column documents, ensures each column index, then reads only first-page task files and validates those. Unloaded files are not read.
- Add `task/page` protocol request/response (see spec). It maps to `BoardService.loadTaskPage`.
- `validateBoard()` remains a separate full scan: it reads every task file, publishes complete diagnostics, rebuilds stale indexes as needed and returns the paginated first-page snapshot plus complete issues so the UI never receives every task body merely to validate.
- Mutations:
  - Single-task create/update/delete keep returning `TaskView`; the host updates the column index entry after the YAML write and the webview patches its loaded page.
  - Moves/reorders return the paginated board snapshot; the affected columns reset to page 1. Position calculations use index entries and never read unloaded bodies; only gap rebalancing reads affected files.
  - Column create/delete/reorder return a paginated snapshot.

### 5. Webview stores per-column pages, not a flat task list

`boardState` gains:

```ts
tasksByColumn: Record<string, TaskView[]>
pages: Record<string, {
  cursor: TaskCursor | null
  hasMore: boolean
  tasksRevision: string
  status: 'idle' | 'loading' | 'error' | 'end'
  error?: string
  requestedCursor?: TaskCursor | null
}>
```

- `loaded` replaces all pages from the snapshot first pages.
- A board push compares each column's `tasksRevision`; unchanged columns keep their loaded tasks and scroll position, changed columns reset to the pushed first page.
- A page response appends only if its revision still matches the column; otherwise it is ignored.
- `task/page` rejects duplicate in-flight requests per column and stores the cursor currently being requested.
- Derived helpers (`tasksForColumn`, move target calculation) read `tasksByColumn` and the full `taskCount`.

### 6. Infinite scroll uses a sentinel with an accessible fallback

- `BoardColumn` observes a sentinel element at the end of its scroll container with `IntersectionObserver` (root = the column scroll element, rootMargin ≈ 120px).
- When visible and `hasMore` and not loading, call `onLoadMore(columnId)`.
- Render a visible **Load more** button whenever `hasMore`; it is the keyboard/assistive fallback and is also used when `IntersectionObserver` is unavailable.
- Show a compact loading row while fetching, a retry action after an error, and an end-of-list hint when `hasMore` is false.
- Preserve the current scroll position when appending; do not reset the column just because a page arrived.
- Both compact and expanded densities use the same loaded pages.

### 7. Drag and keyboard movement with partial columns

- Dropping on the column end uses the column's full `taskCount` (minus the active task when moving within the same column), not the loaded count.
- Dropping over a loaded task uses its index among loaded tasks; unloaded tasks remain after them in the same relative order.
- Keyboard move to an adjacent column appends at the full count.
- `computeMoveTarget` takes a per-column view with `loaded tasks` + `taskCount`; service-side position planning uses the column index, so it does not need to read unloaded task bodies.
- After an authoritative move/reorder snapshot, affected columns reset to page 1 with a fresh cursor and revision.

### 8. Watcher invalidation and reset

- On a `.ikanban/<column>/<task>.yaml` create/change/delete, delete or invalidate `.ikanban/.index/<column>.json` and schedule the existing debounced reload.
- The reload produces a paginated snapshot. Because unchanged columns keep the same `tasksRevision`, the webview resets only the affected column.
- In-flight page requests for a reset column are ignored if their revision no longer matches. Own writes remain suppressed by the existing write registry.
- Changes to `board.yaml` or `column.yaml` still invalidate the whole board snapshot.

## Risks / Trade-offs

- **Index staleness when size and mtime do not change** → treat size or mtime change as stale, use millisecond mtimes, and rebuild on any parse/identity failure in a page.
- **External agents edit task YAML directly** → index is validated against directory metadata on every page, and the extension never writes task content from the index.
- **Index files pollute the project** → store under `.ikanban/.index/`, git-ignore it, exclude it from YAML discovery and document safe deletion.
- **Cursor moves after reorder/external edits** → revision+taskId cursor and conflict resets; never guess a numeric offset.
- **Partial drag semantics can surprise users** → full counts on headers, explicit end-of-column behavior and tests for drops over loaded tasks versus column end.
- **First load with no index still scans the column once** → unavoidable for file truth; subsequent loads/pages are cheap. Build indexes lazily per column and only for columns being loaded.
- **Scroll position loss on a column reset** → reset only the affected column; other columns keep their pages. Show a loading state while the reset page arrives.
- **Validation appears incomplete until explicit validate** → make the difference explicit in docs and keep the Validate Board command as the full scan.

## Migration Plan

- No task YAML migration. Add `.ikanban/.index/` to `.gitignore`; existing boards build indexes on first load.
- Rollback is safe: deleting `.ikanban/.index/` has no data effect, and an older extension version simply ignores the directory.
- Existing board snapshots gain optional pagination metadata; code that only reads `tasks` continues to see the first pages and the full column counts.
