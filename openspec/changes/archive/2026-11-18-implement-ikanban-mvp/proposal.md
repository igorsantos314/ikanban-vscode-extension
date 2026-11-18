# Proposal

## Why

The repository currently contains only the default VS Code "Hello World" extension scaffold. iKanban needs a functional, local-first Kanban board that lets developers organize tasks inside VS Code without a server, account, or external database. The value is a portable, Git-friendly project board whose source of truth is a small set of human-readable YAML files.

## What Changes

- Replace the scaffold command with the `ikanban.initialize`, `ikanban.open`, `ikanban.validate` and `ikanban.refresh` commands and a contributed webview panel in the editor area.
- Introduce a layered TypeScript codebase: framework-free domain models and rules, application use cases, YAML/VS Code filesystem infrastructure, a React + Tailwind webview, and a thin VS Code integration layer.
- Implement the `.ikanban` persistence layout: `board.yaml`, one directory per column with `column.yaml`, and one independent YAML file per task with embedded checklists and items.
- Implement board initialization (idempotent, never overwriting existing data), column CRUD/reordering, task CRUD/movement/reordering, and nested checklist and checklist item CRUD with derived progress.
- Implement centralized visual tags (`issue`, `feat`, `chore`, `spec`) with icons and labels, persisted as canonical string arrays.
- Implement two-stage YAML validation (syntax via `yaml` parser diagnostics, then Zod schema and cross-file semantic checks) and publish actionable VS Code diagnostics without repairing, deleting or overwriting invalid files.
- Implement safe persistence: URI-based `vscode.workspace.fs` access, path constraining, optimistic revision checks against external edits, temporary-file replacement where supported, serialized mutations, and recovery behavior for cross-file operations.
- Implement a `FileSystemWatcher`-driven refresh with debouncing and self-write suppression, plus conflict reporting when files change while a task is being edited.
- Implement a typed, Zod-validated webview messaging protocol with request IDs, structured errors, duplicate-mutation prevention and a strict content security policy.
- Implement the React board UI: themed board header, ordered columns, task cards with counts, priority and tag badges, checklist progress, drag-and-drop between and within columns, empty/loading/error states, and a reusable accessible `TaskDialog` for create/edit with a full checklist editor.
- Add the required build, test and packaging infrastructure: Vite webview build, separate extension/webview TypeScript configurations, Vitest unit and React Testing Library component tests, real-filesystem repository integration tests, and VS Code extension integration tests.
- Rewrite the README to document setup, commands, the YAML format, validation, testing and known limitations.

## Capabilities

### New Capabilities

- `board-storage`: `.ikanban` directory layout, `board.yaml` format, idempotent initialization, safe write/replace behavior, revision conflict detection, external-change handling and path safety.
- `column-management`: column creation, title/color updates, ordering via `board.yaml`, directory/configuration consistency, and guarded deletion.
- `task-management`: independent task YAML files, task create/read/update/delete, tags/priority/timestamps, deterministic positions, moves between columns and reordering.
- `checklist-management`: nested checklists and checklist items with stable IDs, CRUD, deterministic ordering and derived progress.
- `yaml-validation`: two-stage YAML syntax and schema validation, cross-file integrity checks, diagnostics ranges and aggregate error reporting.
- `vscode-integration`: commands, workspace folder selection, trust handling, webview panel lifecycle, typed messaging, CSP, watcher wiring and diagnostics publication.
- `kanban-ui`: board rendering, column/task interactions, tag presentation, drag-and-drop, the create/edit task dialog and accessible UI feedback.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- **Existing code**: `src/extension.ts` and `src/test/extension.test.ts` are replaced/extended; the `ikanban.helloWorld` command is removed.
- **Build**: `package.json`, `tsconfig.json`, ESLint config, `.vscodeignore`, `.vscode-test.mjs` and VS Code launch/tasks configuration are updated; new Vite, Vitest and webview files are added.
- **Dependencies**: adds React, React DOM, Vite, Tailwind CSS, dnd-kit, `yaml`, Zod, Vitest, jsdom and React Testing Library as development/runtime dependencies; no SQLite, cloud, auth or AI dependencies.
- **Extension surface**: four contributed commands, a webview panel, a diagnostic collection, an output channel and a filesystem watcher.
- **Repository data**: writes only inside the selected workspace folder's `.ikanban` directory; the extension never modifies files outside it.
- **Compatibility**: requires a trusted VS Code workspace with filesystem support for the selected URI scheme; remote workspaces work when their provider supports the used file operations.
