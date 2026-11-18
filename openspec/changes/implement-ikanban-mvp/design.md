# Design

## Context

The repository is the stock VS Code extension scaffold: a single `src/extension.ts` that registers `ikanban.helloWorld`, one sample extension test, TypeScript compiled directly to `out/` with `module: Node16`, ESLint, and `@vscode/test-cli` configured to run `out/test/**/*.test.js`. There is no React, bundler, schema library, YAML library or unit-test runner yet. See `proposal.md` for motivation and `specs/` for the behavioral contract.

Constraints that shape the design:

- Runtime is the VS Code Extension Host (Node 24) with `vscode` engine `^1.146.0`; the webview runs in a separate browser-like context with no Node access.
- All persistence must go through `vscode.workspace.fs`, including remote URI schemes, so the filesystem boundary must not assume `node:fs` or a local path.
- Domain and persistence code must be testable under Vitest without importing the `vscode` runtime.
- The board format is the source of truth and must remain human-editable, portable and Git-friendly.
- The extension must survive invalid YAML, filesystem failures and external edits without corrupting data or crashing.

## Goals / Non-Goals

**Goals:**

- A dependency direction that keeps domain and use cases independent of VS Code, React and YAML.
- Real-filesystem tests for every persistence path, plus component and extension-host tests.
- A deterministic YAML writer that round-trips tricky text and preserves comments/unknown fields where it can do so safely.
- A single, typed, validated message boundary between React and the Extension Host.
- Predictable ordering with minimal rewrites and optimistic concurrency for detected external edits.
- A build that produces both the Node extension bundle output and a self-contained webview bundle.

**Non-Goals:**

- Database-like transactions across multiple YAML files, SQLite, caching infrastructure, cloud sync, authentication or AI features.
- Rendering Markdown or raw HTML from task text (plain text only in the MVP).
- Board renaming, custom user-defined tags, per-column task limits, attachments, archived tasks or multi-board-per-folder support.
- Extending the YAML schema beyond version 1 or implementing a future-version migration.
- Webview hot-reload infrastructure; a webview rebuild is required to see UI changes.

## Decisions

### 1. Layered source layout with a composition root

```
src/
  domain/            pure models, invariants, tag definitions, ordering, errors
  application/       use cases, ports, DTOs, mutation queue
  infrastructure/    YAML codecs, repositories, path/layout helpers, FS ports
  shared/            webview protocol schemas and DTO types (no vscode import)
  vscode/            commands, workspace resolver, panel, router, watcher, diagnostics
  extension.ts       composition root and activate/deactivate
  webview/           React application, components, state, styles
  test/              VS Code integration tests and fixtures
```

Dependency rules:

- `domain` imports nothing from the other layers.
- `application` imports `domain` and its own ports only.
- `infrastructure` imports `domain`, `yaml`, `zod` and the filesystem port types.
- `vscode` imports all layers and is the only layer that imports the `vscode` module at runtime.
- `webview` imports React, `shared`, and pure domain constants/types (for tag IDs); it never imports `vscode`, `infrastructure` or application services.

**Alternative considered:** a single `extension.ts` with helpers. Rejected because it makes real-filesystem testing and separation of validation from UI communication impossible at the required scale.

### 2. Domain model and deterministic ordering

Domain entities:

- `BoardConfig { version: 1; name: string; columnIds: string[] }`
- `Column { id: string; title: string; color: string }`
- `Task { id; title; description; columnId; tags; priority; position; checklists; createdAt; updatedAt }`
- `Checklist { id; title; position; items: ChecklistItem[] }`
- `ChecklistItem { id; text; completed; position }`

`columnId` is runtime context derived from the containing directory; it is not a serialized task field. Revisions, file URIs and parse issues are persistence/application concerns, not domain fields.

Rules live in small pure functions:

- `deriveColumnId(title)` → NFKD normalization, diacritics removed, lowercase, runs of non-alphanumerics collapsed to `-`, trimmed, max 64 chars, pattern `^[a-z0-9][a-z0-9-]*$`. If the result is empty (for example a title made only of symbols or CJK), it falls back to `column`; a collision is reported as a duplicate instead of silently changing the ID.
- `normalizeTags(tags)` → validates against the canonical `TagId` list, rejects duplicates, sorts by canonical order `issue`, `feat`, `chore`, `spec`.
- `sortByPosition` → `(position, id)` ascending, giving deterministic order even for duplicated positions created externally.
- `getChecklistProgress` → `{ completed, total }` computed on demand.
- `planPosition(items, targetIndex)` → append at `max + 1024`, otherwise midpoint between neighbors; returns `{ position, rebalanced?: Map<id, number> }` when the gap is exhausted.

Ordering uses `POSITION_STEP = 1024`. Rebalancing only touches files in the affected parent (one column for tasks, one task for checklists/items). No stored progress counters exist.

IDs come from an application port `IdGenerator` backed by `randomUUID()` in production and a deterministic sequence in tests. Timestamps come from a `Clock` port so tests can assert exact ISO strings. The persisted representation is always `new Date().toISOString()` (`YYYY-MM-DDTHH:mm:ss.sssZ`).

**Alternative considered:** fractional/flexible positions. Rejected because equal-position files and float serialization make ordering and validation less predictable; spaced integers with midpoint insertion are simpler and deterministic.

### 3. Persistence ports: URI-based filesystem plus separate repositories

The application layer defines a `WorkspaceFileSystem` port using a structurally compatible `UriLike` type:

```ts
interface UriLike {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;
  toString(): string;
}
```

Methods delegate to the `vscode.workspace.fs` equivalents: `readFile`, `writeFile`, `delete`, `createDirectory`, `readDirectory`, `stat`, and `rename`. The port also exposes `joinPath`, `dirname` and `basename`. The production adapter wraps `vscode.Uri` and `vscode.workspace.fs`; the Vitest adapter is a real Node `fs/promises` implementation over temporary directories. No repository imports `vscode` at runtime.

Persistence is split into two cohesive repositories instead of separate board/column/task repositories:

- `BoardRepository` — read/write `board.yaml`, list column directories, read/write/delete `column.yaml`, create/delete column directories, list task files.
- `TaskRepository` — read/write/create/delete/move task files.

Both return parse results rather than throwing on invalid data:

```ts
type DocumentResult<T> =
  | { ok: true; value: T; revision: string; raw: string }
  | { ok: false; issues: ValidationIssue[] };
```

`revision` is a SHA-256 digest of the persisted bytes. It is opaque to the UI and used for optimistic concurrency.

**Alternative considered:** one repository per filesystem operation or one `BoardRepository` covering everything. Too much duplication in the first case; too large and untestable in the second. Two repositories plus codecs keep the surface small.

### 4. YAML parsing, schema validation and serialization

Parsing uses `yaml` `parseAllDocuments` with `{ uniqueKeys: true, strict: true, prettyErrors: false }`:

- More than one document is a validation error with the start position of the extra document.
- Parser errors and duplicate-key errors become `ValidationIssue`s with `line`, `column` and the raw message; the first error is enough to reject the document.
- `toJS({ maxAliasCount: 100 })` is used to bound alias expansion; custom tags are never executed.
- The root must be a mapping before schema validation.

Schemas use Zod 4 and are the only definition of the persisted shape. Key choices:

- `board.version` is `z.literal(1)`; a different number yields an explicit `UnsupportedSchemaVersionError` issue, not a generic type error.
- Unknown top-level keys are allowed (`.passthrough()`) so forward-compatible metadata and manual fields survive round-trips. Known fields are strict about types and values. Unknown tags and priorities are rejected.
- Timestamps use a strict UTC ISO 8601 regex plus an instant check; `createdAt`/`updatedAt` are required.
- Positions are non-negative integers; colors are `#rrggbb`; IDs are non-empty safe strings.
- Duplicate tags in a task, duplicate checklist IDs in a task and duplicate item IDs in a checklist are schema-level semantic errors.
- Optional description may be an empty string; titles and checklist text must be non-empty when trimmed.
- `checklists` is required but may be empty; each embedded object is validated independently.

Cross-file checks live in the application `LoadBoard` use case, not in Zod: board references vs. directories, duplicate board references, missing `column.yaml`, directory/ID mismatch, unreferenced directories, duplicate task IDs across files, filename/ID mismatch, and unsupported versions.

Serialization:

- New documents are created from canonical objects with a `Document`, `lineWidth: 0` and string-aware node creation, so ambiguous strings (`true`, `null`, dates, numbers, `#`, `:`) are quoted/represented as strings.
- Updates load the existing `Document`, then set only the changed paths. This preserves comments, key order and unknown top-level fields outside replaced subtrees. Replacing a checklist array necessarily drops comments inside that array; this is documented.
- Every serialized mutation is reparsed before writing (validation after apply), which catches serializer regressions.
- Discovery ignores temporary files (`*.tmp`, names with a `.tmp.` segment) and only considers `.yaml` files inside column directories. `column.yaml` is never a task, and `board.yaml` is never a column.

**Alternative considered:** strict schemas rejecting unknown fields. Rejected because the spec requires preserving unrelated fields and comments where safely possible, and users may keep local annotations. Unknown fields are preserved but cannot override known field validation.

### 5. Application use cases and mutation semantics

The application service exposes:

- Board: `InitializeBoard`, `LoadBoard`/`GetBoard`, `ValidateBoard`.
- Columns: `CreateColumn`, `UpdateColumn`, `DeleteColumn`, `ReorderColumns`.
- Tasks: `CreateTask`, `UpdateTask`, `DeleteTask`, `MoveTask`, `ReorderTask`.
- Checklists: `CreateChecklist`, `UpdateChecklist`, `DeleteChecklist`.
- Checklist items: `CreateChecklistItem`, `UpdateChecklistItem`, `DeleteChecklistItem`, `ToggleChecklistItem`.

All mutations go through a `MutationQueue` that serializes async work per extension instance. Use cases validate inputs, enforce domain rules, delegate persistence, and return either an updated task record or a fresh `BoardSnapshot` for structural changes:

- Task field/checklist updates return `{ task, revision }`; the webview patches that task in place.
- Structural changes (create/delete/move/reorder/column operations) return a fresh `BoardSnapshot` so counts and order are authoritative.
- Loading always returns a partial snapshot with `issues`, valid columns/tasks and any invalid-file references. An invalid `board.yaml` yields `board: null` and issues rather than a fabricated board.

Concurrency and failures:

- Every update/delete/move carries the revision observed at load. The repository re-reads the file and compares the digest; mismatch raises `ConflictError` without writing.
- Moves write the target first (same task ID, recalculated position, updated `updatedAt`), then delete the source. If the target write fails, the source is untouched; if the source delete fails, the target copy is removed and a `StorageError` is raised.
- Column creation writes `column.yaml`, then updates `board.yaml`; a failed board update removes the new directory. Column deletion checks for task files, updates `board.yaml`, then deletes the directory; a failed directory deletion restores the previous board list.
- Initialization enumerates `.ikanban`: absent or empty → create defaults; existing `board.yaml` → load only; non-empty without `board.yaml` → `StorageError` and no writes.
- Granular checklist use cases exist and are tested because the protocol requires them; the task dialog still saves title, tags and checklist changes atomically through `task/update`, matching the spec requirement.

### 6. Filesystem writes and revision tracking

`YamlFileStore` centralizes reads, writes and digests:

- Read bytes → decode UTF-8 with a fatal decoder (invalid UTF-8 becomes a `StorageError`). Preserve raw text for comment-aware parsing.
- Write: validate content, attempt `writeFile(tempUri, bytes)`, then `rename(tempUri, targetUri, { overwrite: true })`. If the provider rejects rename or overwrite, delete the temp file and fall back to a direct `writeFile`. Any failure is translated to `StorageError`.
- A `WriteRegistry` records `(uri, digest, timestamp)` for host-initiated writes. The watcher suppresses an event when the current digest equals a recorded digest within a two-second window; otherwise it reloads. This avoids loops without permanently ignoring external writes.
- A small `ParseCache` keyed by `uri + digest` reuses parsed documents for unchanged files during board reloads. It stores only derived parse results, never authoritative state, and is bypassed when the digest changes.

**Alternative considered:** unconditional atomic rename. Some remote providers do not support overwrite or atomic replacement; the fallback plus explicit error reporting is the honest behavior. The extension never claims transactionality across files.

### 7. Validation issues, diagnostics and errors

`ValidationIssue` is a plain object:

```ts
{
  uri: string;                 // file URI
  severity: 'error' | 'warning';
  code: string;                // e.g. 'yaml/syntax', 'schema/required', 'board/missing-column'
  message: string;             // human-readable, actionable
  path?: string;               // YAML/domain path, e.g. 'checklists[0].items[1].id'
  range?: { startLine; startColumn; endLine; endColumn }; // 0-based, optional
}
```

- Parser errors provide 1-based line/column; these are converted to 0-based `Range`s.
- Schema errors use the closest known key range from the YAML `Document` when available; otherwise they use a conservative fallback range at the document start. Cross-file errors use the referencing document's start range or the board file.
- The integration layer maps issues to a dedicated `DiagnosticCollection` named `iKanban`, using `DiagnosticSeverity.Error`/`Warning` and `source: 'iKanban'`.
- The collection is fully replaced on each successful validation pass, so fixed/deleted files clear automatically. Reloads triggered by the watcher update it too.

Errors are classes with a stable `code` and `userMessage`:

`ValidationError`, `EntityNotFoundError`, `DuplicateEntityError`, `StorageError`, `ConflictError`, `UnsupportedSchemaVersionError`, `WorkspaceNotAvailableError`.

Infrastructure translates filesystem exceptions into `StorageError` and logs the technical cause to the output channel. The protocol mapper serializes only `{ code, message }`; stack traces never cross the webview boundary.

### 8. VS Code integration and lifecycle

`activate` is the composition root:

1. Create an output channel (`iKanban`) and a diagnostic collection.
2. Create the VS Code filesystem adapter, repositories, services and workspace resolver.
3. Register the four commands and the webview panel serializer/restorer.
4. Create the watcher for `.ikanban/**/*.yaml` and wire debounced reloads.
5. Push every disposable into `context.subscriptions`.

Workspace resolution:

- `vscode.workspace.workspaceFolders` empty → `WorkspaceNotAvailableError`.
- One folder → use it.
- Multiple → `showWorkspaceFolderPick`; persist the chosen URI in `context.workspaceState` under `ikanban.workspaceFolderUri`; re-prompt if the remembered folder is no longer open.
- Explicitly check `vscode.workspace.isTrusted` before writes and surface an actionable message.

Panel:

- One static current panel. `createOrShow` either reveals/reloads the existing panel or creates a new one in `ViewColumn.Active`.
- `localResourceRoots` is limited to `dist/webview`. The HTML is generated in code with a per-load nonce and CSP:

```
default-src 'none';
img-src ${webview.cspSource} data:;
style-src ${webview.cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}';
font-src ${webview.cspSource};
```

- Assets are fixed-name build outputs (`assets/index.js`, `assets/index.css`) loaded through `webview.asWebviewUri`, avoiding manifest parsing.
- On visibility change to visible, reload from disk and post the snapshot.
- If `dist/webview` assets are missing, the panel shows a build instruction instead of a blank page.

Messaging:

- `src/shared/protocol.ts` defines the request union and Zod payload schemas plus response/push types. The host validates every request with the same schemas the webview uses for type safety.
- Requests carry `{ type, requestId, payload }`. Responses carry `{ type: 'response', requestId, ok: true, data }` or `{ ok: false, error: { code, message } }`.
- The router tracks in-flight request IDs and rejects duplicate mutations instead of applying them twice. Unknown types and malformed payloads produce structured errors.
- Push messages (`board/updated`, `board/error`) carry a version counter so the webview can ignore an older snapshot that races a mutation response.
- `file/open` opens the referenced document at the supplied range, with a fallback to the start of the file.

Watcher:

- `vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootUri, '.ikanban/**/*.yaml'))`.
- Events debounce for ~200 ms; one reload per burst. The WriteRegistry suppresses own-write loops. A reload pushes the partial snapshot and diagnostics. If the webview has an open dirty dialog, it keeps local state; the next save hits the revision check and returns `ConflictError`.

Test seam: `activate` returns a small `IkanbanApi` (`initialize`, `open`, `validate`, `refresh`, `dispatch`, `dispose`) used by extension integration tests. It is not a public API contract but makes command-to-persistence flows testable without brittle webview automation.

### 9. React webview architecture

- React 19 + `createRoot`, no routing and no global state library. A single `useReducer` holds `{ status, snapshot, dialog, confirm, validationOpen, banner }`.
- `useBoardClient` wraps `acquireVsCodeApi`, correlates request IDs with promises, validates push messages, and exposes typed `send` methods.
- Board: `BoardHeader`, `ColumnList`, `Column`, `TaskCard`, `TagChip`, `ChecklistProgress`, `ValidationPanel`, `EmptyState`, `LoadingState`, `ErrorBanner`.
- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` with pointer and keyboard sensors, a `SortableContext` per column and a `DragOverlay`. On drop, the reducer applies a pending order; after the host responds, it applies the authoritative snapshot or restores the previous order and shows an error. `TaskCard` and `Column` are memoized with stable callbacks to limit rerenders.
- `TaskDialog` (one component, `mode: 'create' | 'edit'`):
  - Fields: title, multiline description, column select, priority select, tag multi-select, checklist editor.
  - Local draft state, field-level errors, `saving` flag, dirty comparison against the loaded task, custom accessible modal (`role="dialog"`, `aria-modal`, focus trap, Escape handling, focus restore) instead of native `<dialog>` for predictable jsdom behavior.
  - New checklist/item IDs are generated in the webview with `crypto.randomUUID()` when an item is added; the host validates format and uniqueness. The task ID, column ID and timestamps are host-generated. A failed save keeps the draft and its IDs.
  - Discard confirmation appears when closing a dirty draft. Conflict responses show a reload action; the dialog remains open.
- Tag visuals: canonical IDs live in `src/domain/tags.ts`; icon SVG path data, labels and color classes live in one `tagVisuals` map consumed by `TagChip` and the selector. No icon dependency is added. Selected state uses `aria-pressed` plus a check mark, so meaning is never color-only.
- Styling: Tailwind CSS 4 through `@tailwindcss/vite`, with CSS variables from VS Code (`--vscode-editor-background`, `--vscode-foreground`, `--vscode-panel-border`, `--vscode-focusBorder`, etc.) for surfaces, text, borders and focus. Tag colors are semantic accents with borders, icons and labels; high-contrast themes keep outlines and text readable.
- Safety: descriptions render as text with `white-space: pre-wrap`; no `dangerouslySetInnerHTML` anywhere. Long text wraps and columns scroll internally.
- Accessibility: labelled controls, `aria-invalid`/`aria-describedby` for field errors, keyboard-operable tag buttons, keyboard DnD sensor, visible focus styles, live-region announcements for errors/success and a focus trap in dialogs.

**Alternative considered:** native `<dialog>` + `showModal`. Rejected because jsdom lacks the API, requiring test polyfills, and webview focus behavior is less predictable across VS Code versions. A small tested focus-trap hook is more controllable.

### 10. Build and test tooling

Build:

- `tsconfig.json` remains the extension config (strict, Node16, `out/`), extended with `noUncheckedIndexedAccess`, `noImplicitOverride` and explicit `types`; includes `src/extension.ts`, `src/domain`, `src/application`, `src/infrastructure`, `src/shared`, `src/vscode`, `src/test`; excludes `src/webview`.
- `tsconfig.webview.json` uses `jsx: react-jsx`, `module: ESNext`, `moduleResolution: Bundler`, DOM libs and `noEmit`; includes `src/webview`, `src/shared` and the pure domain tag module.
- Vite builds `src/webview/main.tsx` to `dist/webview` with fixed output names, `base: './'`, CSS extracted to `assets/index.css`, and sourcemaps for development. No `index.html` is needed because the extension generates the webview document itself.
- Scripts:
  - `build:extension` → `tsc -p tsconfig.json`
  - `build:webview` → `vite build`
  - `build` → both
  - `compile` → `build:extension` (keeps VS Code launch/tests working)
  - `watch` → `tsc -w -p tsconfig.json`
  - `check:types` → both `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.webview.json`
  - `lint` → ESLint over `src` and config files
  - `test:unit` → `vitest run`
  - `test:integration` → `npm run build && vscode-test`
  - `test` → unit then integration
  - `check` → type checks, lint, unit tests
  - `package` → build + `vsce package` (with `@vscode/vsce` as a dev dependency)
- `.vscodeignore` excludes `src/**`, tests, configs, fixtures and source maps while including `out/**` and `dist/**`.

Tests:

- `vitest.config.ts`: jsdom environment, `@testing-library/jest-dom` setup, include `src/**/*.test.ts(x)`, exclude `src/test/**` (extension-host tests).
- Domain tests are pure and table-driven for positions, tags, progress, ID derivation and error rules.
- Infrastructure/application integration tests use `createTempWorkspace()` + `NodeWorkspaceFileSystem` over real `fs/promises`, so YAML is written, read, moved and deleted for real. No repository mocks are used for persistence assertions.
- Tests that need deterministic UUIDs/timestamps inject sequence `IdGenerator` and fixed `Clock`.
- Component tests render the webview with a fake `BoardClient`, use `@testing-library/user-event`, and assert visible behavior, field errors, tag states, checklist edits, save/discard behavior and DnD keyboard alternatives. `acquireVsCodeApi` is provided by the jsdom setup.
- Extension tests run through `@vscode/test-cli` with a dedicated fixture workspace (`src/test/fixtures/workspace`, empty except a tracked placeholder). Setup deletes any `.ikanban`; teardown removes it. Tests activate the extension, run commands, dispatch protocol requests through the returned API, verify files on disk, check diagnostics and complete the required end-to-end flow.
- The coverage target focuses on domain rules, use cases, repositories, codecs and protocol validation; superficial call-count tests are avoided.

**Alternative considered:** running all repository tests against the VS Code host. Rejected because it would be slow and require a display; the Node filesystem adapter exercises the same repository code with real files, while extension tests cover the VS Code adapter separately.

### 11. Package and command metadata

- `package.json`: display name `iKanban`, description in English, version `0.1.0`, `main: ./out/extension.js`.
- Commands: `ikanban.initialize` ("iKanban: Initialize Board"), `ikanban.open` ("iKanban: Open Board"), `ikanban.validate` ("iKanban: Validate Board"), `ikanban.refresh` ("iKanban: Refresh Board").
- `activationEvents`: the four command events plus `onWebviewPanel:ikanban.board`.
- `capabilities.untrustedWorkspaces.supported: "limited"`.
- No configuration settings in the MVP.
- Dependencies: runtime `react`, `react-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `yaml`, `zod`; dev `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@vscode/vsce`, and React type packages. No Redux, icon library or state-management framework.

## Risks / Trade-offs

- **Multi-file operations are not atomic** → Ordered writes with explicit rollback and tests for move, column create and column delete. Failures are reported, never hidden.
- **`vscode.workspace.fs.rename` semantics vary by provider** → Try temp+rename, fall back to direct write, clean up temp files, surface `StorageError`. A provider crash mid-write can still leave a partial file; this limitation is documented.
- **Comment preservation versus schema evolution** → Known fields are strict; unknown top-level fields pass through and comments survive when only paths are updated. Comments inside wholesale-replaced arrays (checklists) are lost.
- **Self-write watcher suppression can hide a genuinely concurrent external edit** → Suppression requires a matching digest within a two-second window; otherwise the board reloads, and revision checks still protect saves.
- **Webview-generated checklist/item IDs** → The host validates UUID format and uniqueness before persisting; invalid or duplicate IDs are rejected, so client IDs cannot corrupt the document.
- **Custom modal focus management** → A focused accessibility test and keyboard tests cover opening, tab cycling, Escape, dirty-close confirmation and focus restoration.
- **Tailwind colors in high-contrast themes** → All surfaces/focus use VS Code CSS variables; tag chips keep icon and text labels and explicit borders. Manual verification in light, dark and high-contrast themes is part of verification.
- **Extension tests need a display on Linux** → Document running `xvfb-run -a npm run test:integration` in headless environments; unit and component tests stay display-free.
- **Full reload on structural mutations** → Acceptable for small/medium local boards; the parse cache avoids reparsing unchanged files by digest, and task field/checklist saves patch only the affected task.
- **Large boards** → DnD and card rendering are memoized, but no virtualization is added in the MVP; documented as a known limitation.
- **Remote filesystem performance** → Each mutation re-reads and validates its file for conflict detection as required; no speculative caching of authoritative state.

## Migration Plan

1. Update `package.json`, TypeScript/ESLint/Vite/Vitest configuration and `.vscodeignore`; install dependencies. Keep the scaffold compiling until the new layers are in place.
2. Implement domain models, error types, tags, ordering and schemas with unit tests.
3. Implement codecs, filesystem port, Node test adapter and repositories with real-file tests.
4. Implement application use cases and the mutation queue, replacing the Hello World command last.
5. Implement the VS Code adapter, commands, panel, router, watcher and diagnostics, then replace `src/extension.ts` with the composition root.
6. Implement the React webview and build integration.
7. Rewrite the README, run all checks and remove scaffold artifacts (`vsc-extension-quickstart.md`, Hello World sample test).
8. Manual verification against a copied sample `.ikanban` directory; the extension only writes inside `.ikanban`, so rollback is `git revert` plus restoring the directory from Git. Existing version 1 boards are read without migration; future versions are rejected explicitly rather than rewritten.

## Open Questions

None. Deferred details such as Task dialog microcopy, exact tag hues and column width are implementation choices that do not affect the specs, architecture or task breakdown.
