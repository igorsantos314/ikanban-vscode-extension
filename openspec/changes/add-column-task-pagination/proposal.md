# Proposal

## Why

Every board load currently lists and parses every task YAML in every column before the webview can render. On large boards this makes opening the board and refreshing after an external change slow and memory-heavy. Columns should behave like a mobile feed: show the first page immediately, then load the next page when the user reaches the bottom.

The hard part is file-based: task files are named by UUID, so the order and cursor cannot come from file names alone, and reading every file to discover positions would defeat the purpose. A derived, self-repairing per-column index is needed so page requests can seek by `position` and `taskId` without reading unloaded tasks.

## What Changes

- Load only the first page per column (20 tasks) in the initial board snapshot. Columns keep their full task count and expose pagination metadata.
- Add a per-column cursor composed of the last loaded task's **`position` + `taskId`**, plus a **tasks revision** for that column. The next page returns tasks strictly after that cursor in `(position, taskId)` order.
- Add a persisted derived index at `.ikanban/.index/<column-id>.json` containing the ordered task entries (`id`, `position`, file name, size, mtime) and the index revision. The YAML task files remain the single source of truth.
- Make the index self-repairing: compare it with the actual directory entries (names, size, mtime); when it is missing, corrupt or stale, rebuild it from the task files before serving a page. Index writes are atomic and never modify task content.
- Add a `task/page` protocol request returning the next page, the next cursor, `hasMore`, the full task count and the current tasks revision. A stale cursor/revision returns a structured conflict so the column can reset.
- Add infinite-scroll behavior per column using an `IntersectionObserver` sentinel at the column bottom, with an explicit **Load more** button as the accessible fallback. Columns show loading, end-of-list and retry states.
- When an external file change affects a column, reset that column to its first page and invalidate its index. Other columns keep their loaded pages.
- On load, validate only the loaded pages. `iKanban: Validate Board` continues to scan the whole board and publish complete diagnostics.
- Keep the index derived and out of version control; document `.ikanban/.index/` and ensure deleting it is always safe.

## Capabilities

### New Capabilities

- `task-pagination`: file-backed page cursors, per-column ordered index, self-repair and `(position, taskId)` ordering.

### Modified Capabilities

- `kanban-ui`: per-column infinite scroll, loading/end/retry states, reset behavior and partial-page drag/move semantics.
- `vscode-integration`: paginated board snapshots, `task/page` messaging and external-change page invalidation.
- `board-storage`: derived `.index` directory layout, index precedence and safe deletion/rebuild.
- `yaml-validation`: initial load validates loaded pages only; explicit validation remains a full-board scan.

## Impact

- **Domain/application**: new index types and cursor helpers; `BoardService.loadBoard` becomes first-page load; new `loadTaskPage`; full validation path separated.
- **Infrastructure**: task index repository/store, directory stat/list access, atomic JSON writes, index repair; existing YAML repositories stay authoritative for task bodies.
- **Protocol/host**: new `task/page` request and paginated `BoardSnapshot` metadata; watcher/index invalidation; message router.
- **Webview**: App/board state stores tasks per column with cursors and page status; `BoardColumn` sentinel and `Load more`; drag/drop and keyboard move use full counts and loaded offsets.
- **Tests**: cursor ordering/tie-break, index repair for missing/corrupt/stale entries, page seeks, revision conflicts, external-change reset, scroll/load-more UI, drag with partial pages, full validation.
- **Data compatibility**: task YAML is unchanged. The index is derived and optional; boards without it rebuild automatically. Deleting `.ikanban/.index/` loses no data.

## Assumptions

- Initial and subsequent page size is 20 tasks per column.
- The index lives under `.ikanban/.index/`, is git-ignored and is never consulted for task content, only for ordering and locating files.
- If the index and directory disagree, the index is rebuilt from task files; the extension never “repairs” task files from the index.
- External changes reset the affected column to page 1. User scroll position inside that column may be lost, but other columns keep their pages.
- A page request validates the tasks it returns and reports invalid files as diagnostics while omitting them from the page.
