# iKanban

iKanban is a local-first Kanban board for Visual Studio Code. It stores every column and task as readable YAML inside a `.ikanban` directory, so a board can be committed to Git, reviewed in a pull request, edited by hand, or copied to another machine without a server, account or database.

## Features

- Kanban columns with titles, colors, ordering and task counts.
- One YAML file per task, with titles, descriptions, priorities, visual tags and nested checklists.
- Drag-and-drop task moves between columns and reordering within a column, plus keyboard-accessible move controls.
- A reusable create/edit task dialog with field validation, saving state, discard confirmation, checklist editing and read-only creation/last-updated timestamps.
- A Command Palette action that creates a task from a title and column prompt and opens the board.
- A portable agent skill that any AI assistant can install into the workspace to create, update, move, reorder and remove tasks directly.
- Validation of YAML syntax, document schemas and cross-file relationships, published to the VS Code Problems panel.
- External file-change detection with debounced refresh and optimistic revision checks to prevent silently overwriting manual edits.
- A refined board and task dialog with layered surfaces, colored priority badges, neutral tag chips, compact metadata and consistent hover/focus states.
- Theme-aware React interface built with Vite and Tailwind CSS.
- No network access, authentication, cloud storage, SQLite or database. The agent skill is a local Markdown contract, not a runtime AI integration or MCP server.

## Requirements

- VS Code 1.147 or newer.
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
| `iKanban: Create New Task` | Prompts for a title and an existing column, creates the task with default fields and opens the board so details can be added in the task dialog. |
| `iKanban: Validate Board` | Reloads the board, publishes diagnostics and reports an issue summary. |
| `iKanban: Refresh Board` | Reloads the board and updates the open panel. |
| `iKanban: Install AI Skill` | Installs the portable agent skill at `skills/ikanban/SKILL.md` and adds a managed pointer to `AGENTS.md`. |

In a multi-root workspace, iKanban asks which workspace folder to use and remembers the choice for the session. Initialization always asks again so the board is created in the intended folder.

## Activity Bar

After installation, iKanban adds an entry to the VS Code Activity Bar. The home view is a launcher and status panel: it shows whether the selected workspace has a board and whether the AI skill is installed, current or outdated, and it never opens the board automatically.

The actions follow that state:

- **Open board** and **Validate board** appear when `.ikanban/board.yaml` exists.
- **Initialize board** appears only when the board does not exist and the workspace is trusted.
- **Install AI skill** appears when the skill is missing, and **Update AI skill** appears when the bundled skill differs from the installed one.
- **Refresh** re-reads the state; in a multi-root workspace with no remembered folder, **Select workspace folder** chooses the folder first.

The board itself remains an editor panel; the Activity Bar position (left or right) follows your VS Code layout settings, and iKanban does not move it.

## AI agents and the skill

iKanban ships a portable, provider-neutral agent skill. It is a plain `SKILL.md` contract that any AI assistant with workspace file access can read and follow directly; it does not require an MCP server, a network service or a specific model.

Install it in the selected workspace with **iKanban: Install AI Skill** (`ikanban.installAgentSkill`). The command writes:

```text
skills/ikanban/SKILL.md   # the portable skill
AGENTS.md                 # managed pointer block for agents
```

`AGENTS.md` is created when missing. If it already exists, only the delimited iKanban block is added or replaced, so the rest of the project instructions are preserved. Running the command again is safe and refreshes the skill without duplicating the block.

The Activity Bar home view compares the installed skill with the skill bundled in the current extension. It offers **Update AI skill** when they differ, for example after an extension update. Nothing is overwritten automatically: the refresh happens only when you activate the action, and the managed `AGENTS.md` block is updated while all other content is preserved.

Agents that discover `AGENTS.md` or `skills/` can then use the skill directly to:

- create a task in the backlog or any existing column;
- update a task while preserving its ID and creation date;
- move a task between columns to change its status;
- reorder tasks within a column;
- add, complete or remove checklist items;
- delete a task.

The skill documents the `.ikanban` layout, the full task schema, UUID rules, ISO 8601 UTC timestamps, position spacing, supported tags and the safety rules for direct edits. In particular, an agent must set `createdAt` and `updatedAt` when creating a task, keep `createdAt` unchanged afterwards, refresh `updatedAt` on every successful change or move, never add a status field, use only columns from `board.yaml` and validate the result. The extension's file watcher and Problems panel still report invalid external edits.

The same skill file is useful to humans who want to edit the board by hand or write their own automation. See [Board storage format](#board-storage-format) for the exact YAML shape.

## Using the board

### Columns

Use **+ Add column** to create a column. The column ID is derived from the title (lowercase letters, digits and hyphens), and the column directory uses that ID. Renaming a column changes only its title and never its directory or task IDs. Drag the column header to reorder columns; the rest of the column remains reserved for dragging tasks. A focused header can be moved with `Alt+←/→`. Use the header actions to edit the title/color or delete the column.

A column can only be deleted when it contains no task files. The final remaining column cannot be deleted. Both cases produce an explanatory message.

### Tasks

Use **+ Add task** in a column, or click anywhere on an existing card to edit it. Every column also displays its task count. A click opens the task; dragging anywhere on the card moves it. After a drag, the click is suppressed, so opening and moving do not conflict. Keyboard users can focus a card and press `Enter` to open it, `Alt+←/→` to move it between columns, or `Alt+↑/↓` to reorder it within its column.

Drag-and-drop shows the card following the pointer, previews the target column and insertion point before you release it, reserves the space at the drop position and animates the card into place. The move is persisted only when you drop; a failed move restores the previous order and shows an error.

Use the **Expanded** / **Compact** control in the toolbar to switch card density. **Expanded** shows the description, tag labels, checklist bar, deadline and last-updated time. **Compact** is exactly two lines: the title and one metadata line with priority icon, checklist count, tag icons and deadline. The choice is stored per workspace and restored when the board is reopened.

A task can have an optional deadline with date and time. In the task dialog, fill the masked **DD/MM/AAAA** and **HH:MM** fields; separators are inserted automatically and the form moves from the date to the time field when the date is complete. Both fields are required when a deadline is set, and **Clear deadline** removes it. The card shows the deadline in your local timezone and marks an overdue deadline.

When an existing task is open, text fields start read-only. Click a field (or focus it and press `Enter`/`Space`) to enable editing; it stays editable until the dialog closes. Changes save automatically: text is debounced shortly after typing stops, while column, priority, tag, deadline and checklist toggles are saved immediately. The dialog states this at the top and shows saving, saved, failed or conflict status.

The dialog footer has only **Delete task** for existing tasks and **Voltar**. Voltar flushes any pending save before closing. If an autosave fails or conflicts with a newer external version, the local draft stays visible, the conflict is shown and **Reload** replaces the draft with the persisted task. The creation time never changes; the last-updated time is refreshed after every successful edit, move, reorder or checklist change.

Deleting a task is available from the task dialog and asks for confirmation. The confirmation appears above the task details, which stay visible and inactive until you cancel or confirm. A successful delete removes only that task's YAML file.

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
dueAt: "2026-11-25T14:30:00.000Z"
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
- `dueAt` is optional. When present it must be one ISO 8601 UTC timestamp with both date and time, for example `2026-11-25T14:30:00.000Z`. Omit the key when there is no deadline; do not write `null` or a date-only value.
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
- Drag-and-drop uses a pointer sensor and keyboard shortcuts (`Alt+Arrow`); there is no separate drag handle or arrow-button fallback.
- There is no task virtualization. Very large boards may render slowly.
- Multi-file operations are best-effort and can leave a valid intermediate state if the filesystem fails mid-operation. Failed moves and column deletions roll back where possible.
- The webview has no hot reload; rebuild it after changing React or CSS files.
- A future schema version is rejected explicitly; there is no migration path in the MVP.

## License

MIT. See [LICENSE](LICENSE).
