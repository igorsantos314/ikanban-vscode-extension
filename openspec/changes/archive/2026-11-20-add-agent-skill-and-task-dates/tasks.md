# Tasks

## 1. Display task timestamps in the dialog

- [x] 1.1 Add `src/webview/formatTimestamp.ts` with a locale- and time-zone-injectable formatter for ISO timestamps and unit tests covering valid values, invalid fallback and deterministic locale output.
- [x] 1.2 Add a read-only Created/Last updated metadata section to `TaskDialog` when an existing task is supplied, using `<time datetime>` values and theme-aware styles, and verify with component tests that creation mode hides the section and edit mode shows both timestamps.
- [x] 1.3 Add `BoardService` regression tests asserting that task creation sets equal `createdAt`/`updatedAt` and that updates, moves, reorders and checklist operations update `updatedAt` while preserving `createdAt`; fix any mutation path that fails and verify with `npm run test:unit`.

## 2. Add the portable skill asset

- [x] 2.1 Create `resources/skills/ikanban/SKILL.md` with provider-neutral frontmatter and sections for layout, task schema, timestamps, positions, tags, checklists, add/update/move/reorder/delete recipes, validation and safety; add a unit test that reads the asset and verifies the required fields and rules are present.
- [x] 2.2 Add `src/application/agentSkill.ts` with the install paths, managed `AGENTS.md` markers and a pure merge function, and verify with unit tests that a missing file, existing content and repeated installs preserve outside content and never duplicate the block.
- [x] 2.3 Add `src/vscode/agentSkillInstaller.ts` that reads the bundled template, creates `skills/ikanban`, writes the skill, merges `AGENTS.md`, reports both paths and routes failures through the existing error/output path; verify through the Extension Host tests added in task 2.5.
- [x] 2.4 Contribute the `ikanban.installAgentSkill` command named "Install AI Skill" in `package.json`, register it in `src/extension.ts` after the existing commands, add it to the command-registration test and verify `npm run test:integration` registers it.
- [x] 2.5 Add Extension Host tests that install the skill in the fixture workspace, verify `skills/ikanban/SKILL.md` and the `AGENTS.md` pointer, run the command twice for idempotency, preserve pre-existing `AGENTS.md` content, and verify an untrusted workspace writes nothing; clean up the generated files between tests.

## 3. Add the Create New Task command

- [x] 3.1 Implement the `ikanban.createTask` flow in `src/extension.ts`: resolve the workspace, require trust, load the board, use a single column without prompting or ask with a QuickPick, ask for a non-blank title with validation, abort cleanly on cancel, create with default fields, reveal the board and report success or an actionable error when the board is not initialized.
- [x] 3.2 Contribute `ikanban.createTask` as "Create New Task" in `package.json` and update the command-registration test to expect all six commands including the installer and create-task commands.
- [x] 3.3 Add Extension Host tests with mocked title/column prompts that verify a task is created with the expected defaults, a single-column board skips the picker, cancelling writes nothing, and an uninitialized board reports an error without creating files.

## 4. Document the skill and timestamps

- [x] 4.1 Update README with a dedicated "AI agents and the skill" section stating that the extension ships a portable skill, that `ikanban.installAgentSkill` installs it at `skills/ikanban/SKILL.md` and points `AGENTS.md` at it, that agents can use it directly by editing the documented YAML, which operations it supports and how reinstalling refreshes it; also document the new Create New Task command and the task dialog timestamps.
- [x] 4.2 Add CHANGELOG entries for the portable skill, the skill installer, the Create New Task command and the task dialog timestamps, and verify they match the shipped behavior.

## 5. Validate, package and verify

- [x] 5.1 Run `npm run check` and verify type checks, lint and all unit/component tests pass, including the new formatter, dialog, installer-merge, skill-asset, timestamp and command tests.
- [x] 5.2 Run `npm run test:integration` on VS Code 1.147.0 and verify all Extension Host tests pass, including the six-command surface, skill installation and create-task scenarios.
- [x] 5.3 Run `npm run package` and verify the VSIX includes `resources/skills/ikanban/SKILL.md`, both new command contributions and the updated engine baseline.
- [x] 5.4 Install the packaged VSIX on VS Code 1.147.0, run `ikanban.installAgentSkill` against a test workspace, verify the installed skill and `AGENTS.md` block, run `ikanban.createTask`, and confirm the task dialog shows both timestamps.
