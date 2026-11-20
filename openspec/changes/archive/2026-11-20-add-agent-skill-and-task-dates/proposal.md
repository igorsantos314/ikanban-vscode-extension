# Proposal

## Why

AI agents can already change iKanban boards by editing `.ikanban` YAML, but nothing in the installed extension tells a generic agent how to do it safely. Without a shared contract, models can write invalid timestamps, reuse or invent IDs, lose `createdAt`, leave `updatedAt` stale, use the wrong column, or corrupt ordering. At the same time, users cannot see when a task was created or last changed because the task dialog does not display the timestamps that already exist in the task YAML.

## What Changes

- Add a portable, model-agnostic Agent Skill template that ships inside the extension package. The skill explains the board layout, task schema, timestamp rules, ordering, tags, checklists and safe add/update/move/remove recipes for direct YAML editing.
- Add the command `ikanban.installAgentSkill`. It copies the bundled skill to `<workspace>/skills/ikanban/SKILL.md` and maintains a clearly delimited pointer block in `<workspace>/AGENTS.md`, so agents that discover `AGENTS.md` or `skills/` can find and use it. The command is idempotent, uses the existing workspace-folder selection rules, and respects workspace trust.
- Add the command `ikanban.createTask` ("Create New Task"). It prompts for a title and an existing column, creates a task with default priority, no tags and no checklists, appends it to the chosen column, and opens or reveals the board so the user can add details in the task dialog.
- Require the skill to teach agents to read `board.yaml` before acting, use existing column directory IDs, generate UUIDs, set `createdAt` and `updatedAt` on creation, preserve `createdAt`, refresh `updatedAt` on every successful change or move, keep positions spaced, never add a status field, preserve unknown fields, and validate the result.
- Show read-only `Created` and `Last updated` metadata in the task dialog for existing tasks, using local date/time formatting and machine-readable `<time datetime>` values. Creation mode does not show timestamps because the task does not exist yet.
- Add regression coverage that `updatedAt` changes on every task mutation path (update, move, reorder and checklist operations) while `createdAt` stays stable.
- Update the README with a dedicated section that makes the agent skill explicit: where it is installed, how agents discover and use it directly, which operations it supports, and how to refresh it. Update the CHANGELOG.

## Capabilities

### New Capabilities

- `agent-skill`: defines the portable skill that ships with iKanban, how it is installed into a workspace, and the correctness and safety rules an agent must follow when editing board YAML directly.

### Modified Capabilities

- `vscode-integration`: the command surface grows to six commands with `ikanban.installAgentSkill` and `ikanban.createTask`, including their workspace selection, trust handling, idempotency, prompt behavior and reporting behavior.
- `kanban-ui`: the reusable task dialog displays read-only creation and last-updated timestamps for existing tasks.

## Impact

- `package.json` command contributions and README/CHANGELOG documentation.
- New bundled template under `resources/skills/ikanban/SKILL.md` and a new installer module that writes `skills/ikanban/SKILL.md` plus the managed `AGENTS.md` pointer.
- New task-dialog metadata UI and date-formatting helper.
- New Command Palette flow for creating a task with native prompts, reusing the existing task creation use case and board panel.
- Unit, component and Extension Host tests for the installer, the skill contract, timestamp maintenance, the create-task command and dialog display.
- No changes to the board storage layout, YAML schemas, message protocol or React board state model. Existing boards remain compatible.
