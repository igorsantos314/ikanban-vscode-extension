# Spec Delta

## Purpose

Defines the portable, agent-agnostic skill that ships with iKanban and teaches AI assistants to manage the YAML board safely, including task creation, updates, moves, reordering and removal with correct timestamps and ordering.

## ADDED Requirements

### Requirement: Bundled portable skill

The extension package SHALL include a standalone `SKILL.md` asset with Agent Skills-compatible metadata (`name` and `description`) and plain Markdown instructions. The skill SHALL NOT require network access, a specific AI provider, extension APIs or internal source code. It SHALL document the `.ikanban` directory layout, the board, column and task documents, the canonical task fields, UUID and ISO 8601 UTC timestamp rules, spaced positions, supported tags, priorities, checklist structure and the validation the extension performs.

#### Scenario: Skill ships with the extension

- **WHEN** the extension is installed
- **THEN** the portable skill asset is present inside the installed extension package

#### Scenario: Provider-neutral instructions

- **WHEN** an agent reads the skill
- **THEN** it finds only file paths, YAML rules and operation recipes, with no model-specific tool names or provider-specific APIs required

#### Scenario: Complete task schema

- **WHEN** the skill describes a task document
- **THEN** it covers every required field, the allowed tag and priority values, UUID rules, timestamp format, positions, descriptions and embedded checklists

### Requirement: Workspace skill installation

The extension SHALL expose the command `ikanban.installAgentSkill`. When run, the command SHALL use the same workspace-folder selection rules as the other board commands, SHALL require a trusted workspace, and SHALL install the bundled skill at `<workspace>/skills/ikanban/SKILL.md`. It SHALL create or update `<workspace>/AGENTS.md` with a delimited managed pointer block that tells agents to use the skill. On reinstall the managed block SHALL be replaced rather than duplicated, all content outside the block SHALL be preserved, and the installed `SKILL.md` SHALL be refreshed with the bundled version. The command SHALL report the paths it wrote.

#### Scenario: First installation

- **WHEN** the user runs `ikanban.installAgentSkill` in a trusted workspace with no `skills` directory and no `AGENTS.md`
- **THEN** `skills/ikanban/SKILL.md` and `AGENTS.md` are created, the pointer block is present, and the command reports both paths

#### Scenario: Existing AGENTS content is preserved

- **WHEN** `AGENTS.md` already contains project instructions
- **THEN** the iKanban pointer is added in its managed block and the existing instructions remain byte-for-byte unchanged outside that block

#### Scenario: Idempotent reinstall

- **WHEN** the command runs twice
- **THEN** the skill and pointer block are written once and no duplicate pointer block is created

#### Scenario: Outdated skill is refreshed

- **WHEN** the installed skill differs from the version bundled with the current extension release
- **THEN** the command replaces the installed skill with the bundled version

#### Scenario: No workspace folder

- **WHEN** the command runs with no workspace folder open
- **THEN** it reports that a workspace folder is required and writes no files

#### Scenario: Untrusted workspace

- **WHEN** the command runs in an untrusted workspace
- **THEN** it reports that a trusted workspace is required and writes no files

#### Scenario: Multiple workspace folders

- **WHEN** more than one workspace folder is open
- **THEN** the command follows the same folder selection and remembered-choice rules as the other iKanban commands

#### Scenario: Write failure

- **WHEN** the skill or `AGENTS.md` cannot be written
- **THEN** the command reports an actionable error and does not delete or truncate existing content

### Requirement: Agent task operations

The skill SHALL instruct agents to read `.ikanban/board.yaml` before acting and to use only existing column directories. For task creation, the agent SHALL generate a stable UUID, write `<task-id>.yaml` inside the target column directory, set `createdAt` and `updatedAt` to the same current UTC timestamp, assign a position after the current maximum in that column, use only canonical tags and a valid priority, and embed checklists with UUID identifiers and positions. A task document SHALL NOT contain a status or column field. For updates, the agent SHALL preserve the task ID, `createdAt`, column membership and position unless the request explicitly moves or reorders it, and SHALL update `updatedAt`. For moves, the agent SHALL move the YAML file between existing column directories, recalculate the target position and update `updatedAt` while preserving every other field. For reordering, the agent SHALL assign spaced positions and update `updatedAt` for each task whose position changes. For deletion, the agent SHALL remove only the requested task file.

#### Scenario: Add a task to the backlog

- **WHEN** an agent adds a task to `backlog`
- **THEN** a new `<uuid>.yaml` exists in `.ikanban/backlog` with equal `createdAt` and `updatedAt`, a position after the existing tasks, canonical tags and a valid checklist structure

#### Scenario: Update a task

- **WHEN** an agent changes a task title or description
- **THEN** the task ID, `createdAt`, column and position are preserved and `updatedAt` reflects the change

#### Scenario: Move a task to another column

- **WHEN** an agent moves a task from `backlog` to `in-progress`
- **THEN** the file is removed from the source directory, written to the target directory with the same ID and `createdAt`, a recalculated position and an updated `updatedAt`

#### Scenario: Reorder within a column

- **WHEN** an agent moves a task between two tasks in the same column
- **THEN** its position lies between its neighbors, or the affected column is rebalanced with spaced positions, and the changed tasks receive an updated `updatedAt`

#### Scenario: Remove a task

- **WHEN** an agent deletes a task
- **THEN** only that task's YAML file is removed and sibling tasks and column files are untouched

#### Scenario: Preserve unknown fields

- **WHEN** a task document contains fields the skill does not recognize
- **THEN** the agent preserves them when editing the document

### Requirement: Direct-edit safety

The skill SHALL instruct agents to treat `.ikanban` files as the authoritative data, re-read a document immediately before modifying it, and never invent columns, tasks or identifiers. Agents SHALL NOT add a status or column field, reuse a task or checklist ID, change `createdAt`, leave `updatedAt` stale, write invalid YAML, rewrite unrelated files, or silently resolve an ambiguous target column. Agents SHALL ask for explicit confirmation before destructive or ambiguous operations and SHALL validate the board after editing, reporting validation failures instead of forcing the change.

#### Scenario: Ambiguous target column

- **WHEN** a requested target column is not present in `board.yaml`
- **THEN** the agent asks which existing column to use and writes no task file until the choice is explicit

#### Scenario: Concurrent external change

- **WHEN** a task file changed after the agent read it
- **THEN** the agent re-reads the current content and reconciles before writing instead of overwriting the external change

#### Scenario: Destructive operation requires confirmation

- **WHEN** a request would delete a task or remove checklist content without an explicit instruction
- **THEN** the agent asks for confirmation before deleting anything

#### Scenario: Validation failure is reported

- **WHEN** a proposed change would produce an invalid board document
- **THEN** the agent keeps the original file and reports the validation problem instead of persisting the invalid change

#### Scenario: No unrelated rewrites

- **WHEN** an agent changes one task
- **THEN** only that task file is modified and unrelated board, column and task files remain unchanged
