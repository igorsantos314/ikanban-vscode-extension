# Changelog

## 0.1.1

- Turned the Activity Bar home view into a state-aware launcher: it no longer opens the board automatically, offers Initialize only when the board is missing, and shows board and AI skill status.
- Added explicit Install/Update AI skill actions based on comparing the workspace skill with the bundled skill, including after extension updates.
- Added expanded and compact task-card densities with a persisted workspace preference.
- Added distinct priority icons, tag icons in compact mode and a Trello-like checklist progress bar.
- Added a drag overlay, cross-column insertion preview, reserved drop space and a drop animation for smoother task moves.

## 0.1.0

- Refined the board and task dialog with layered surfaces, quieter borders, colored priority badges, neutral tag chips, compact metadata and a shared visual system.
- Added a portable, provider-neutral agent skill and the `iKanban: Install AI Skill` command that installs `skills/ikanban/SKILL.md` and a managed `AGENTS.md` pointer.
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
