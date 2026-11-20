# Design

## Context

See `proposal.md` for motivation. `TaskView` already exposes `createdAt` and `updatedAt`, and `BoardService` sets both on creation and refreshes `updatedAt` on task updates, moves, reorders and checklist mutations. The task dialog currently renders only editable fields, so the timestamps are invisible. The extension also has an existing workspace resolver, trust checks and URI-based filesystem access used by all board commands.

The extension already ships the `.ikanban` storage format and the React interface. The AI-facing contract does not exist yet, and agents that edit YAML directly bypass the extension's revision checks.

## Goals / Non-Goals

**Goals:**

- Make task creation and last-update timestamps visible and understandable in the task dialog.
- Ship one provider-neutral skill that can be installed into any workspace and teaches an agent to edit the board safely.
- Keep the installer idempotent, trust-aware, remote-workspace compatible and non-destructive to existing project instructions.
- Reuse the existing timestamp semantics instead of introducing a second date model.

**Non-Goals:**

- Adding an MCP server, VS Code Language Model tools or a provider-specific integration.
- Letting users edit timestamps from the dialog.
- Changing the YAML schema, board layout or revision model.
- Automatically rewriting project instructions outside the managed pointer block.
- Guaranteeing that every external agent obeys the skill; the extension only provides the contract and validation feedback.

## Decisions

### Bundle the skill as a package asset and install it into the workspace

Ship the source template at `resources/skills/ikanban/SKILL.md` inside the extension package. The new `ikanban.installAgentSkill` command copies it to `<workspace>/skills/ikanban/SKILL.md` and maintains `<workspace>/AGENTS.md`.

Rationale: the user asked for a generic skill installed with the extension. Keeping the template under `resources/` separates the packaged asset from a workspace installation, avoids treating the extension repository as a consumer, and lets the command refresh an outdated installation. `skills/ikanban/SKILL.md` plus an `AGENTS.md` pointer is discoverable by agents that read either convention and does not require a specific provider. Alternatives considered:

- **Install into `.opencode/skills/`**: automatic for OpenCode but not generic across agents.
- **Write only into the extension installation directory**: agents cannot discover it from the workspace and it is shared across projects.
- **Auto-install on activation**: writes project files without an explicit user action and would touch repositories the user did not intend to modify.

### Use a marked, idempotent `AGENTS.md` block

The installer owns only a block delimited by `<!-- ikanban-skill:start -->` and `<!-- ikanban-skill:end -->`. A pure merge helper replaces an existing block or appends one, preserving every character outside it. If `AGENTS.md` does not exist, the installer creates it with only the managed block. The skill file itself is overwritten with the bundled version on every explicit install.

Rationale: `AGENTS.md` is a shared project file; blindly appending on every run would create duplicates, and replacing the whole file would destroy user instructions. A pure string helper makes preservation and idempotency unit-testable.

### Installer reuses the existing command infrastructure

The command resolves the workspace folder through the existing `resolveFolder` path, rejects untrusted workspaces with the existing trust error, reads the bundled template with `workspace.fs` and writes with `workspace.fs` so local and remote providers behave consistently. It creates the `skills/ikanban` directory, writes the skill, then merges `AGENTS.md`, and reports both paths. Failures are reported through the existing command error path and output channel.

Rationale: this keeps multi-root prompting, remembered folder selection, trust semantics and error presentation identical to the other commands. It also avoids introducing a second filesystem abstraction. The command is registered after the existing commands and before the home view provider.

### Quick-create command with native prompts

`ikanban.createTask` loads the selected board, asks for the target column with `showQuickPick` unless the board has exactly one column, asks for the title with `showInputBox` and inline validation, then calls the existing `BoardService.createTask` with an empty description, priority `medium`, no tags and no checklists. It reveals the board panel afterwards and reports success. Cancelling either prompt aborts without writing.

Rationale: the command must work from the Command Palette even when the board panel is closed, and it must not depend on the webview being loaded. Native prompts are keyboard-accessible and reuse the existing workspace, trust and persistence paths. The rich task dialog remains the place for tags, checklists, priority and description. Alternatives considered:

- **Open the board and trigger the React dialog**: requires a new host-to-webview push type, a readiness handshake so the message is not lost before React mounts, and additional protocol tests. Rejected for this change.
- **Collect every field through quick input**: produces a long, poor Command Palette flow and duplicates the task dialog.
- **Use the first column silently**: wrong for multi-column boards and hides the target from the user.

### Keep the skill discovery documented explicitly

The README gets a dedicated "AI agents and the skill" section stating that the extension ships a portable skill, that `ikanban.installAgentSkill` writes it to `skills/ikanban/SKILL.md` and points `AGENTS.md` at it, and that agents can use it directly by editing the documented YAML files. The section also clarifies that this is a file-based contract, not a chat endpoint or MCP server, lists the supported operations and explains that reinstalling refreshes the skill.

Rationale: the user asked for the skill to be obvious and usable by any agent. Documentation is the discovery surface for humans and for agents that read project instructions.

### Keep the skill self-contained and provider-neutral

The skill is a plain Markdown file with Agent Skills frontmatter (`name`, `description`) and no model-specific instructions. It documents:

- `.ikanban/board.yaml`, column directories and `column.yaml` files.
- Task fields and constraints: UUID, filename, description, tags, priority, position, checklists, `createdAt`, `updatedAt`, and the absence of a status or column field.
- Timestamp rules: ISO 8601 UTC with optional 1-3 fractional digits and `Z`; new tasks set both values to the same current instant; every later change updates `updatedAt`; `createdAt` is immutable.
- Position rules: spaced integers, append after the column maximum, midpoint insertion, column-local rebalance when no gap remains.
- Recipes for creating a task in the backlog, updating a task, moving a task between columns, reordering, toggling checklist items and deleting a task.
- Safety: read `board.yaml` first, use only existing columns, re-read before writing, preserve unknown fields and unrelated files, ask before destructive or ambiguous actions, and validate afterwards.

The example task YAML is derived from `toPersistedTask` so the skill and the extension serialize the same shape. The skill is intentionally asset-based rather than generated from TypeScript, because it must remain readable by non-JavaScript agents.

### Show timestamps in the dialog only

`TaskDialog` receives an existing `TaskView` and renders a read-only metadata section when `task` is defined. A small formatter converts the persisted ISO value to a localized date/time string with `Intl.DateTimeFormat`, while each value is wrapped in `<time dateTime={iso} title={iso}>` so the machine-readable value is preserved. The creation dialog omits the section.

Rationale: the user chose the dialog as the display location. The card stays compact, and the dialog is where a user already inspects complete task details. Formatting is presentation-only; persistence remains authoritative. Tests assert the `dateTime` attribute rather than locale-dependent text, and the formatter accepts an optional locale for deterministic unit tests.

### Add timestamp regression tests instead of changing the storage model

The implementation audits every mutation path (`updateTask`, `moveTask`, checklist create/update/delete/toggle and reorder) and adds assertions that `updatedAt` advances while `createdAt` stays fixed. Any discovered path that does not refresh the timestamp is fixed in the service, not worked around in the UI.

## Risks / Trade-offs

- **Skill and schema drift** → The skill ships from the same package release and the install command refreshes it; tests assert the skill mentions the required fields and timestamp rules.
- **Overwriting a user-customized skill** → The installer is explicit and documented as refreshing the managed skill file; all other project files are preserved.
- **`AGENTS.md` block conflicts** → Markers are replaced idempotently and the merge helper preserves content outside the block, with tests for missing, existing and repeated blocks.
- **Direct YAML edits bypass revision checks** → The skill requires re-reading before writing and validating afterwards; the extension watcher still reports externally introduced invalid documents.
- **Locale-dependent date text in tests** → Tests assert `datetime` attributes and use the injectable locale for text snapshots.
- **Timestamps already work but are untested** → Regression tests cover each mutation path; no schema or migration change is required.
- **Writing project files in an untrusted workspace** → The installer reuses the existing trust guard and writes nothing when the workspace is untrusted.

## Migration Plan

1. Add the bundled skill asset and the installer command with its pure merge helper.
2. Register the installer and quick-create commands, update command tests and README.
3. Add the dialog metadata section and formatter.
4. Add timestamp regression tests, run unit and Extension Host suites, package the VSIX and verify the installed commands on VS Code 1.147.0.

Rollback removes the commands and asset and reverts the dialog section. No board data migration is required.
