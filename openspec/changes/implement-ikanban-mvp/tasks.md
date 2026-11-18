# Tasks

## 1. Foundation and tooling

- [ ] 1.1 Record the baseline: run `npm run compile`, `npm run lint` and `npm run test` and note the existing scaffold results before changes
- [ ] 1.2 Add runtime dependencies (`react`, `react-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `yaml`, `zod`) and dev dependencies (`vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `jsdom`, React Testing Library packages, `@vscode/vsce`, type packages) and verify `npm install` completes
- [ ] 1.3 Add all scripts from the design (`build:extension`, `build:webview`, `build`, `compile`, `watch`, `check:types`, `lint`, `test:unit`, `test:integration`, `test`, `check`, `package`) and verify each script is listed by `npm run`
- [ ] 1.4 Split TypeScript configuration into a strict extension config (`tsconfig.json`, Node16, `out/`, tests included, webview excluded) and `tsconfig.webview.json` (React JSX, DOM, no emit) and verify `npm run check:types` passes on the scaffold
- [ ] 1.5 Configure Vite to build `src/webview/main.tsx` into `dist/webview` with fixed `assets/index.js` and `assets/index.css` names, and verify `npm run build:webview` produces both files
- [ ] 1.6 Configure Vitest with jsdom, jest-dom setup and exclusion of `src/test/**`, add a temporary smoke test, and verify `npm run test:unit` runs it and exits cleanly
- [ ] 1.7 Update ESLint for TypeScript and React hooks, update `.vscodeignore` to ship `out/**` and `dist/**` while excluding sources/tests/fixtures, and verify `npm run lint` passes

## 2. Domain layer (TDD)

- [ ] 2.1 Write failing tests for canonical tag IDs, unknown-tag rejection, duplicate rejection and canonical ordering; implement `src/domain/tags.ts` and verify the tag tests pass
- [ ] 2.2 Write failing tests for position planning, append/midpoint insertion, tie-breaking by ID and column-local rebalancing; implement `src/domain/positions.ts` and verify the tests pass
- [ ] 2.3 Write failing tests for checklist progress with zero, empty, partial and fully completed checklists; implement `getChecklistProgress` and verify the tests pass
- [ ] 2.4 Write failing tests for task, checklist and checklist item invariants (required trimmed titles/text, priorities, timestamps, non-negative positions, unique nested IDs); implement the domain models and validators and verify the tests pass
- [ ] 2.5 Write failing tests for deriving safe column IDs (accents, spaces, symbols, empty result, length cap) and verify `deriveColumnId` handles every case
- [ ] 2.6 Write failing tests for the application error classes and their stable codes/user messages; implement `src/domain/errors.ts` and verify the tests pass

## 3. YAML schemas, parsing and serialization (TDD)

- [ ] 3.1 Write failing schema tests for board, column, task, checklist and item documents covering required fields, wrong types, nulls, priorities, tags, colors, positions, timestamps, duplicate nested IDs and unsupported schema versions; implement the Zod schemas and verify the tests pass
- [ ] 3.2 Write failing parser tests for invalid indentation, unclosed quotes, duplicate mapping keys, malformed sequences, scalar/sequence roots, multiple documents and alias limits; implement the strict YAML parser with line/column issues and verify the tests pass
- [ ] 3.3 Write failing round-trip tests for accents, Unicode, emoji, CJK, quotes, colons, hashes, backslashes, slashes, multiline/blank-line descriptions, leading/trailing spaces, `true`/`false`/`null` strings, date-like and numeric strings, anchors/aliases, long text, CRLF/LF, empty optionals, Markdown and HTML-like text; implement serialization and verify semantic equality and safe quoting
- [ ] 3.4 Write failing tests for comment/unknown-field preservation when updating a single field and for clean replacement when replacing a checklist array; implement comment-aware document updates and verify the tests pass
- [ ] 3.5 Write failing tests for board/column/task codecs returning value plus content revision and mapping parser/schema failures to stable issue codes; implement the codecs and verify the tests pass

## 4. Infrastructure and repositories (TDD)

- [ ] 4.1 Implement the `WorkspaceFileSystem` port with `UriLike`, the VS Code adapter, and a real Node `fs/promises` adapter with temporary-directory `UriLike` construction; verify a real write/read/delete round-trip test passes
- [ ] 4.2 Write failing tests for durable writes: temp-file plus rename, direct-write fallback, temp cleanup on failure, UTF-8 handling and ignored temp files; implement `YamlFileStore` and verify the tests pass
- [ ] 4.3 Write failing tests for `BoardRepository`: read/write `board.yaml`, list/create/delete column directories, read/write/delete `column.yaml`, list task files, reject unsafe IDs and return revisions; implement it and verify the tests pass
- [ ] 4.4 Write failing tests for `TaskRepository`: create/read/update/delete task files, filename/ID identity, duplicate target detection, move between columns and reload after restart; implement it and verify the tests pass
- [ ] 4.5 Write failing tests for revision conflicts: change the file between read and write, expect `ConflictError`, and assert the external content is preserved; implement revision checks and verify the tests pass
- [ ] 4.6 Write failing tests for the self-write registry and digest-keyed parse cache behavior; implement both and verify changed digests bypass cached parses

## 5. Application use cases (TDD)

- [ ] 5.1 Build the real-filesystem test harness: temporary workspace, Node filesystem adapter, repository wiring, deterministic `IdGenerator` and fixed `Clock`; verify a scaffold use-case test runs against actual YAML files
- [ ] 5.2 Write failing tests for `InitializeBoard`: empty/missing directory, empty `.ikanban`, existing board idempotency with tasks, incomplete non-empty directory failure and exact default columns; implement it and verify the tests pass
- [ ] 5.3 Write failing tests for `LoadBoard`/`GetBoard` and cross-file validation: missing referenced column, missing `column.yaml`, directory/ID mismatch, duplicate board references, duplicate task IDs, filename mismatch, unreferenced directory warning, invalid board and mixed valid/invalid tasks; implement it and verify the tests pass
- [ ] 5.4 Write failing tests for column CRUD and reorder: create, update title/color, safe ID, duplicate rejection, append order, reorder, empty deletion, populated rejection, final-column rejection and rollback paths; implement them and verify the tests pass
- [ ] 5.5 Write failing tests for task CRUD: valid create/persist/reload, title/description/priority/tag updates, delete plus file removal, invalid data, duplicate IDs and not-found updates; implement them and verify the tests pass
- [ ] 5.6 Write failing tests for task moves and reordering: cross-column move, preserve ID/content/checklists/completion, recalculate position, append to target, within-column reorder, midpoint and rebalance, reload after restart, collision and partial-failure recovery; implement them and verify the tests pass
- [ ] 5.7 Write failing tests for checklist CRUD: create/persist/reload, rename, reorder, delete, empty checklist, invalid IDs, duplicate IDs, nonexistent updates and unrelated-field preservation; implement them and verify the tests pass
- [ ] 5.8 Write failing tests for checklist item CRUD: create, edit text, delete, complete/incomplete toggle, reorder, persist and reload, progress updates, duplicate IDs, nonexistent updates and completion preservation across moves; implement them and verify the tests pass
- [ ] 5.9 Write a failing test for `UpdateTask` changing its column and verify it performs a safe move with all fields preserved, then implement the column-change path
- [ ] 5.10 Write a failing test for the mutation queue with rapid create/update/move requests and verify they apply in order with a consistent final state; implement the queue and verify the test passes
- [ ] 5.11 Write failing tests for `ValidateBoard` aggregation and assert invalid files remain byte-for-byte unchanged; implement it and verify the tests pass

## 6. Typed protocol

- [ ] 6.1 Define request, response and push schemas/types for every message in the spec plus `file/open`, with request IDs, structured errors and board snapshot DTOs; write tests for valid requests, malformed payloads, unknown types and duplicate IDs and verify they pass
- [ ] 6.2 Write failing tests for mapping application errors to protocol responses without stack traces; implement the mapper and verify the tests pass

## 7. VS Code integration

- [ ] 7.1 Implement the workspace folder resolver (no folder, single folder, remembered multi-root choice, stale choice) and verify it with unit tests over fake folder lists
- [ ] 7.2 Implement the composition root, command registration and activation events; verify an extension-host smoke test registers all four commands and no Hello World command
- [ ] 7.3 Implement the diagnostics manager mapping `ValidationIssue`s to a dedicated collection with fallback ranges, and verify range/severity mapping with unit tests
- [ ] 7.4 Implement the webview HTML builder with nonce, CSP, `localResourceRoots` and fixed asset URIs; verify a unit test asserts the nonce, CSP directives and asset paths
- [ ] 7.5 Implement the message router with schema validation, in-flight duplicate prevention, serialized use-case dispatch, structured errors and `file/open`; verify router unit tests cover success, malformed payload, duplicate mutation and handler failure
- [ ] 7.6 Implement the board panel lifecycle (single panel, reveal, refresh on visibility, empty/error state, missing-asset message) and verify with a unit test of the pure HTML/state helpers plus extension smoke behavior
- [ ] 7.7 Implement the filesystem watcher with ~200 ms debounce, self-write suppression, diagnostics refresh and push notifications; verify debounce and suppression unit tests pass
- [ ] 7.8 Create the extension test fixture workspace, clean `.ikanban` in setup/teardown and configure `@vscode/test-cli`; verify an activation test runs with `npm run test:integration`
- [ ] 7.9 Add extension tests for command registration, initialization from the command, board opening and diagnostics publication on an invalid file; verify they pass against real files
- [ ] 7.10 Add the required end-to-end extension test: initialize → create column → create task → add checklist → add items → complete item → move task → reload board → verify persisted YAML → delete task → delete empty column; verify the test passes with real persistence
- [ ] 7.11 Add an extension test for workspace-trust rejection and for the no-workspace error path, and verify no files are written

## 8. React interface

- [ ] 8.1 Implement `useBoardClient` (typed send, request correlation, push handling, error propagation) with unit tests for correlation and out-of-order push handling
- [ ] 8.2 Implement the reducer and task patching for load, create, update, delete, move, column changes, validation issues and banners; verify reducer tests cover structural snapshots and single-task patches
- [ ] 8.3 Implement centralized tag visuals (icon paths, labels, colors) and `TagChip`; verify component tests assert icon plus label and non-color-only selected state
- [ ] 8.4 Implement `BoardHeader`, columns, counts, cards, progress, `EmptyState`, `LoadingState` and `ErrorBanner`; verify component tests for full metadata, optional data, long text, empty and loading states
- [ ] 8.5 Implement column create/edit/reorder/delete controls with validation and rejection messages; verify component tests for success, populated-column rejection and final-column rejection
- [ ] 8.6 Implement `TaskDialog` fields, validation, tag selection, saving state, duplicate-submit prevention, save success/failure, dirty tracking and discard confirmation; verify component tests for every behavior
- [ ] 8.7 Implement the checklist editor inside `TaskDialog` (multiple checklists, add/rename/delete, items add/edit/delete/toggle, progress); verify component tests for zero/one/multiple checklists and empty checklists
- [ ] 8.8 Implement task deletion confirmation and opening an existing task with its complete data; verify component tests for confirm, cancel and full-field rendering
- [ ] 8.9 Implement dnd-kit drag-and-drop for between-column moves and within-column reordering, including keyboard movement and optimistic rollback on host failure; verify handler tests cover drop, reorder and rollback
- [ ] 8.10 Implement the validation panel with issue counts, file navigation and refresh/validate success feedback; verify component tests for issue display and file-open requests
- [ ] 8.11 Implement the accessible modal focus trap, Escape behavior, field error associations, labels and focus restoration; verify accessibility-focused component tests pass
- [ ] 8.12 Apply Tailwind styling with VS Code theme CSS variables, internal column scrolling, high-contrast outlines and safe text wrapping; verify `npm run build:webview` succeeds and manually check light, dark and high-contrast rendering

## 9. Documentation and packaging

- [ ] 9.1 Rewrite `README.md` with overview, setup, launch/debug, commands, initialization, column/task usage, tags, checklists, complete YAML examples, validation behavior, test/build/package commands and known limitations; verify every documented command exists
- [ ] 9.2 Update `package.json` metadata (`iKanban` display name, description, version, commands, activation events, trust capability) and remove the Hello World contribution; verify `npm run build` and `npm run lint`
- [ ] 9.3 Remove scaffold artifacts (`vsc-extension-quickstart.md`, sample Hello World test/code) and verify no placeholder implementation, unused command or obsolete reference remains
- [ ] 9.4 Add a CHANGELOG entry and verify `vsce package` produces a VSIX containing `out/**` and `dist/**` but no source or test fixtures

## 10. Verification

- [ ] 10.1 Run `npm run check` and verify type checks, lint and all unit/component tests pass without skipped or hidden failures
- [ ] 10.2 Run `npm run build` and verify the extension output and both webview assets exist and load in a panel
- [ ] 10.3 Run `npm run test:integration` (with `xvfb-run -a` if headless) and verify the end-to-end flow and diagnostics tests pass against real files
- [ ] 10.4 Perform a manual extension-host smoke test: initialize, create/edit/delete columns and tasks, edit tags and checklists, drag between columns, edit YAML externally, fix and break files, and confirm diagnostics and conflict handling
- [ ] 10.5 Walk the Definition of Done and specs checklist, record any residual limitation in the README and final report, and verify no requirement is claimed complete without a passing check
