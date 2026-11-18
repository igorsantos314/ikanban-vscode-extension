# iKanban

iKanban is a local-first Kanban board for Visual Studio Code. It stores every column and task as readable YAML inside a `.ikanban` directory, so a board can be committed to Git, reviewed in a pull request, edited by hand, or copied to another machine without a server, account or database.

## Features

- Kanban columns with titles, colors, ordering and task counts.
- One YAML file per task, with titles, descriptions, priorities, visual tags and nested checklists.
- Drag-and-drop task moves between columns and reordering within a column, plus keyboard-accessible move controls.
- A reusable create/edit task dialog with field validation, saving state, discard confirmation and checklist editing.
- Validation of YAML syntax, document schemas and cross-file relationships, published to the VS Code Problems panel.
- External file-change detection with debounced refresh and optimistic revision checks to prevent silently overwriting manual edits.
- Theme-aware React interface built with Vite and Tailwind CSS.
- No network access, authentication, cloud storage, SQLite or AI integration.

## Requirements

- VS Code 1.146 or newer.
- A trusted workspace folder. iKanban refuses to write board files in Restricted Mode.
- Local or remote workspace filesystem providers that support reading, writing, deleting, creating directories and renaming files through `vscode.workspace.fs`.

## Installation and development setup

```bash
npm install
npm run build
```

To run the extension from source:

1. Open this repository in VS Code.
2. Press `F5` (Run Extension). The pre-launch task builds both the Extension Host code and the webview.
3. In the Extension Development Host, open a workspace folder.
4. Run **iKanban: Initialize Board** from the Command Palette.

For continuous Extension Host compilation use `npm run watch`; rebuild the webview with `npm run build:webview` after UI changes. The webview does not hot-reload.

## Commands

| Command | Description |
|---|---|
| `iKanban: Initialize Board` | Creates `.ikanban` with `board.yaml` and the default **Backlog**, **In Progress** and **Done** columns. Idempotent and never overwrites an existing board. |
| `iKanban: Open Board` | Opens or reveals the board panel and refreshes it from disk. Shows an initialization state when no board exists. |
| `iKanban: Validate Board` | Reloads the board, publishes diagnostics and reports an issue summary. |
| `iKanban: Refresh Board` | Reloads the board and updates the open panel. |

In a multi-root workspace, iKanban asks which workspace folder to use and remembers the choice for the session. Initialization always asks again so the board is created in the intended folder.

## Using the board

### Columns

Use **+ Add column** to create a column. The column ID is derived from the title (lowercase letters, digits and hyphens), and the column directory uses that ID. Renaming a column changes only its title and never its directory or task IDs. Use the column header actions to edit the title/color, move the column left or right, or delete it.

A column can only be deleted when it contains no task files. The final remaining column cannot be deleted. Both cases produce an explanatory message.

### Tasks

Use **+ Add task** in a column, or open an existing card to edit it. Every column also displays its task count. Tasks can be moved with drag-and-drop or with the arrow buttons on each card. The card shows its priority, visual tags and overall checklist progress.

Deleting a task asks for confirmation and removes only that task's YAML file.

### Tags

The MVP supports exactly four tags:

| ID | Label | Icon | Meaning |
|---|---|---|---|
| `issue` | Issue | Bug | Bug or problem |
| `feat` | Feature | Sparkles | New feature |
| `chore` | Chore | Wrench | Maintenance |
| `spec` | Spec | File | Specification |

Tags are stored as canonical identifiers and displayed with both an icon and a text label, so color is never the only signal. Unknown or duplicate tags are rejected by validation. Custom tags are intentionally not supported.

### Checklists

A task can contain zero, one or many checklists, and each checklist can contain zero or many items. The task dialog supports adding, renaming and deleting checklists; adding, editing, deleting, completing and uncompleting items; and displays derived progress for each checklist. Progress is never stored as a counter; it is always computed from item state.

All checklist changes are saved atomically with the task update. A failed save leaves the original YAML file unchanged.

## Board storage format

All board data lives inside the selected workspace folder:

```text
.ikanban/
  board.yaml
  backlog/
    column.yaml
    <task-uuid>.yaml
  in-progress/
    column.yaml
  done/
    column.yaml
```

Task membership comes from the directory containing the task file. There is no separate `status` field.

### `board.yaml`

```yaml
version: 1
name: My Project
columns:
  - backlog
  - in-progress
  - done
```

- `version` must be `1`. Future versions are reported explicitly and are not rewritten.
- `columns` is the visual order and must contain every column exactly once.
- Every referenced ID must have a matching directory with a valid `column.yaml`.

### `column.yaml`

```yaml
id: backlog
title: Backlog
color: "#64748b"
```

- `id` must match the directory name and use lowercase letters, digits and hyphens.
- `color` must be a six-digit hexadecimal value.
- Renaming the title does not rename the directory.

### Task YAML

Every task is a separate file named `<task-uuid>.yaml` inside its column directory:

```yaml
id: "550e8400-e29b-41d4-a716-446655440000"
title: Implement user authentication
description: |
  Implement authentication using Google.

  Include error handling and session validation.
tags:
  - feat
  - spec
priority: high
position: 1024
checklists:
  - id: "650e8400-e29b-41d4-a716-446655440001"
    title: Implementation
    position: 1024
    items:
      - id: "750e8400-e29b-41d4-a716-446655440002"
        text: Create login screen
        completed: true
        position: 1024
      - id: "750e8400-e29b-41d4-a716-446655440003"
        text: Integrate authentication provider
        completed: false
        position: 2048
createdAt: "2026-11-18T10:00:00.000Z"
updatedAt: "2026-11-18T10:00:00.000Z"
```

Rules for manual editing:

- `id` must be a UUID and must match the file name.
- `title` is required and must not be blank.
- `description` is optional; an empty string is valid.
- `tags` is a list of supported identifiers and must not contain duplicates.
- `priority` is `low`, `medium` or `high`.
- `position` is a non-negative integer. Lower positions appear first. iKanban uses spaced integers (steps of 1024) and rebalances only the affected column when a gap is exhausted.
- `createdAt` and `updatedAt` are ISO 8601 UTC timestamps. iKanban writes milliseconds, for example `2026-11-18T10:00:00.000Z`.
- Checklist IDs and checklist item IDs must be UUIDs and must be unique in their scope.
- Checklist item text and checklist titles are required.
- Unknown top-level fields are preserved. Comments are preserved when iKanban updates individual fields; replacing a checklist array can remove comments inside that array.

## Validation and diagnostics

Every discovered YAML file is checked in two stages:

1. **Syntax**: duplicate mapping keys, invalid indentation, malformed arrays/mappings, unclosed strings, multiple YAML documents and excessive alias expansion are rejected. Parser diagnostics include line and column information when available.
2. **Schema and semantics**: required fields, types, priorities, tags, colors, IDs, timestamps, positions, schema version, nested duplicate IDs, column references, missing `column.yaml`, directory/ID mismatches, unreferenced directories, duplicate task IDs across files and task filename/ID mismatches.

Invalid files are never repaired, deleted or overwritten automatically. Valid tasks remain available when another task is invalid. Diagnostics appear in the Problems panel with the `iKanban` source; the board header shows a validation status and a list of issues that can open the affected file.

Errors shown in the interface are concise and actionable. Technical details and stack traces are written to the **iKanban** output channel only.

## Reliability and external edits

- All filesystem access goes through `vscode.workspace.fs`, including remote workspaces.
- Writes validate the document, use a temporary file and rename where supported, fall back to a direct write, and use UTF-8.
- Each task/column has a content revision. Saving a stale dialog fails with a conflict message instead of overwriting external changes.
- A filesystem watcher observes `.ikanban/**/*.yaml`, debounces bursts, ignores the extension's own writes and refreshes the panel and diagnostics.
- Moves and column deletion use ordered writes and rollback where possible. iKanban does not claim database-style transactions across multiple YAML files.

## Testing

```bash
npm run test:unit          # domain, YAML, persistence, protocol, React tests
npm run test:integration   # real VS Code extension host tests
npm run test               # both
npm run check              # type checks + lint + unit tests
```

The unit suite includes real-file persistence tests against temporary directories, YAML round-trips for accents, emoji, CJK, quotes, reserved-looking words, multiline and HTML-like text, and React Testing Library tests for the board, task dialog, tags, checklists, validation panel and accessible modal behavior. The extension suite runs a real VS Code Extension Host against a fixture workspace and verifies initialization, commands, diagnostics and an end-to-end column/task/checklist/move/reload/delete flow.

On a headless Linux machine, run the extension tests with `xvfb-run -a npm run test:integration`.

## Build and package

```bash
npm run check:types
npm run lint
npm run build
npm run package
```

`npm run build` compiles the Extension Host to `out/` and the webview to `dist/webview/assets/index.js` and `index.css`. `npm run package` builds and produces a `.vsix` with `vsce`. The package includes `out/**` and `dist/**` and excludes sources, tests, OpenSpec files and source maps.

## Known limitations

- Board renaming is not implemented; edit `board.yaml` manually.
- Only the four supported tags exist. There is no custom tag management.
- Task descriptions are rendered as plain text. Markdown is not rendered and HTML is never interpreted.
- Columns are reordered with header buttons rather than drag-and-drop.
- Drag-and-drop uses pointer and keyboard sensors; arrow buttons provide a non-pointer fallback.
- There is no task virtualization. Very large boards may render slowly.
- Multi-file operations are best-effort and can leave a valid intermediate state if the filesystem fails mid-operation. Failed moves and column deletions roll back where possible.
- The webview has no hot reload; rebuild it after changing React or CSS files.
- A future schema version is rejected explicitly; there is no migration path in the MVP.

## License

MIT. See [LICENSE](LICENSE).
