# Changelog

## 0.3.0

- New tasks are now inserted at the top of their column instead of the end, with a column-local rebalance when the first task is already at position `0`.
- Updated the agent skill and documentation to prepend new tasks and describe the new position rules.
- Fixed board refresh races by serializing board loads with mutations and rejecting stale page responses.
- Fixed TypeScript matcher typings for `@testing-library/jest-dom` with Vitest 5.
- Redefined compact cards as exactly two lines: title plus priority, checklist count, tag icons and deadline.
- Added an optional task deadline with masked `DD/MM/AAAA` and `HH:MM` fields, stored as one ISO 8601 UTC `dueAt` timestamp and shown in local time.
- Made the whole card clickable to open and draggable to move, removing the drag handle and per-card arrow/delete buttons.
- Added keyboard shortcuts: `Enter` opens a card; `Alt+Arrow` moves it between columns or positions.
- Added header drag-and-drop for reordering columns, with column preview, overlay and `Alt+Arrow` keyboard reordering; removed the column arrow buttons.
- Stacked the delete confirmation above the task details dialog, keeping details visible and inert until the delete is confirmed.
- Added click-to-edit text fields, debounced autosave for task and checklist changes, a visible save-status label, Delete/Voltar-only actions and conflict reload.
- Added concurrency coverage for simultaneous task updates, checklist changes and external board-file edits.
- Added per-column lazy pagination with a first page of 20 tasks, infinite scroll and a Load more fallback.
- Added a derived, self-repairing `.ikanban/.index/` to page task files by `(position, taskId)` without reading every YAML.
- Added `task/page`, per-column revisions, reset on external changes, and full-board validation separate from first-page validation.
- Added `npm run build:release` to clean, type-check, lint, run unit/integration tests and package the VSIX with a SHA256 summary.
- Installed the AI skill at `.agents/skills/ikanban/SKILL.md` and linked it from `AGENTS.md`.
- Moved task deletion into the task dialog with the existing confirmation flow.
- Added icons and distinct colors to the dialog Save/Create, Cancel and Delete actions.

## 0.1.1

- Turned the Activity Bar home view into a state-aware launcher: it no longer opens the board automatically, offers Initialize only when the board is missing, and shows board and AI skill status.
- Added explicit Install/Update AI skill actions based on comparing the workspace skill with the bundled skill, including after extension updates.
- Added expanded and compact task-card densities with a persisted workspace preference.
- Added distinct priority icons, tag icons in compact mode and a Trello-like checklist progress bar.
- Added a drag overlay, cross-column insertion preview, reserved drop space and a drop animation for smoother task moves.

## 0.1.0

- Refined the board and task dialog with layered surfaces, quieter borders, colored priority badges, neutral tag chips, compact metadata and a shared visual system.
- Added a portable, provider-neutral agent skill and the `iKanban: Install AI Skill` command that installs `.agents/skills/ikanban/SKILL.md` and a managed `AGENTS.md` pointer.
- Added the `iKanban: Create New Task` command with title and column prompts.
- Added read-only creation and last-updated timestamps to the task dialog, with regression coverage for every mutation path.
- Added an iKanban Activity Bar entry whose home view redirects to the board screen, with Open, Initialize and Validate actions as a fallback.
- Raised the minimum supported VS Code version to 1.147 and aligned the type definitions with that baseline.
- Added the local-first iKanban board stored as YAML in `.ikanban`.
- Added idempotent initialization with Backlog, In Progress and Done columns.
- Added column CRUD, ordering and guarded deletion.
- Added task CRUD with independent YAML files, priorities, visual tags and nested checklists.
- Added drag-and-drop movement and deterministic spaced ordering.
- Added two-stage YAML syntax and schema validation with VS Code diagnostics.
- Added external file watching, debounced refresh and revision conflict detection.
- Added the React, Vite and Tailwind webview interface with an accessible task dialog.
- Added unit, real-filesystem, component and VS Code Extension Host test suites.
