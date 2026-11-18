# board-storage Specification

## Purpose

Defines the portable `.ikanban` YAML storage layout, initialization behavior, and the safety guarantees that keep persisted files authoritative and user data intact.

## Requirements

### Requirement: Portable board directory layout

The extension SHALL store all board data under a `.ikanban` directory inside the selected workspace folder. Board-wide configuration SHALL live in `.ikanban/board.yaml`. Every column SHALL have its own directory containing a `column.yaml` file. Every task SHALL have its own YAML file inside its column directory. Checklists and checklist items SHALL be embedded in the task YAML file and SHALL NOT be stored as separate files.

#### Scenario: Complete layout after initialization

- **WHEN** the user initializes a board in an empty workspace folder
- **THEN** `.ikanban/board.yaml`, `.ikanban/backlog/column.yaml`, `.ikanban/in-progress/column.yaml` and `.ikanban/done/column.yaml` exist

#### Scenario: Independent task files

- **WHEN** the user creates a task in a column
- **THEN** exactly one new `<task-id>.yaml` file is created in that column directory and no other task file is modified

#### Scenario: Portable without external state

- **WHEN** the `.ikanban` directory is copied to another location and opened as a workspace
- **THEN** the same columns and tasks are displayed without requiring a server, database, account or network connection

### Requirement: Board configuration document

`board.yaml` SHALL contain a supported schema version, a non-empty board name, and an ordered list of unique column IDs. The order of the `columns` list SHALL determine the visual order of columns. Column membership of tasks SHALL be derived only from the task file's directory and SHALL NOT be duplicated as a task status field.

#### Scenario: Board order is authoritative

- **WHEN** `board.yaml` lists `backlog`, then `in-progress`, then `done`
- **THEN** the board displays the columns in exactly that order

#### Scenario: Board title is displayed

- **WHEN** `board.yaml` contains `name: My Project`
- **THEN** the Kanban interface displays `My Project` as the board title

#### Scenario: Task column comes from the directory

- **WHEN** a valid task file exists in the `in-progress` directory
- **THEN** the task is displayed in the `in-progress` column without consulting a task status field

### Requirement: Idempotent initialization

The initialization operation SHALL require an open and selected workspace folder, SHALL create `.ikanban` only when initialization is explicitly requested, and SHALL be idempotent. When `.ikanban/board.yaml` already exists, initialization SHALL load the existing board and SHALL NOT write, overwrite or delete any board, column or task file. When `.ikanban` is absent or empty, initialization SHALL create `board.yaml` and the default columns `backlog` with title `Backlog`, `in-progress` with title `In Progress`, and `done` with title `Done`. When `.ikanban` contains files but no `board.yaml`, initialization SHALL fail with an actionable storage error without modifying or deleting the existing files.

#### Scenario: Initialize an empty workspace

- **WHEN** the user runs `ikanban.initialize` in a workspace folder without a `.ikanban` directory
- **THEN** a valid board with the three default columns is created and the board interface opens

#### Scenario: Reinitialize without data loss

- **WHEN** the user runs `ikanban.initialize` on a board that already contains custom columns and tasks
- **THEN** every existing file keeps its original content and no new default column is added

#### Scenario: Empty existing directory

- **WHEN** `.ikanban` exists but contains no entries
- **THEN** initialization creates the default board in that directory

#### Scenario: Incomplete board is not invented

- **WHEN** `.ikanban` contains task or column files but no `board.yaml`
- **THEN** initialization reports that the board is incomplete and leaves every existing file unchanged

### Requirement: URI-based workspace access and path containment

All workspace reads and writes SHALL use VS Code URI-based workspace filesystem APIs rather than assuming local Node.js paths, so local and supported remote workspace schemes work. Generated paths SHALL be constrained to the selected `.ikanban` directory. Column IDs used as directory names SHALL be validated as stable, safe identifiers and SHALL reject empty values, `.`, `..`, path separators, NUL characters and any value that could escape the board directory. YAML content SHALL never be executed, and task descriptions SHALL never be treated as code.

#### Scenario: Unsafe column identifier is rejected

- **WHEN** `board.yaml` references a column ID such as `../outside`
- **THEN** validation reports an unsafe column identifier and no file outside `.ikanban` is read or written

#### Scenario: Remote workspace support

- **WHEN** the selected workspace folder uses a URI scheme whose filesystem provider supports the required file operations
- **THEN** the extension reads and writes the board through that provider without requiring a local path

#### Scenario: Description content is inert

- **WHEN** a task description contains shell syntax, HTML-like text or YAML tags
- **THEN** the content is stored and displayed as text and is never executed or interpreted as code

### Requirement: Durable single-file writes

A single-file mutation SHALL read the current document, validate it, verify the expected revision, apply the change, validate the resulting document, serialize it to UTF-8, and persist the replacement safely. Where the filesystem provider supports replacement, the extension SHALL write a temporary file in the same directory and rename it over the original. When atomic replacement is unavailable, the extension SHALL fall back to a direct write, clean up the temporary file, and report a storage error if persistence fails. Temporary files SHALL NOT be treated as task documents. Mutations SHALL avoid rewriting unrelated files.

#### Scenario: Validation failure leaves the original intact

- **WHEN** a requested task update would produce an invalid document
- **THEN** the original file remains byte-for-byte unchanged and the operation returns a validation error

#### Scenario: Temporary file is not a task

- **WHEN** a temporary write file exists in a column directory during persistence
- **THEN** board discovery ignores it and does not report it as a task

#### Scenario: Unrelated files are not rewritten

- **WHEN** the user changes one task's title
- **THEN** only that task's YAML file is rewritten

### Requirement: Optimistic concurrency and conflict detection

Each task and column document SHALL have a revision derived from its persisted content. A mutation SHALL be rejected with a conflict error when the current file content no longer matches the revision observed when the user loaded or began editing it. The extension SHALL NOT silently overwrite externally modified content. The user SHALL be told that the file changed outside iKanban and that a reload is required, and data entered in an open dialog SHALL remain available until the user resolves the conflict.

#### Scenario: External edit prevents overwrite

- **WHEN** a task file is modified outside VS Code while its dialog is open, and the user then saves
- **THEN** the save is rejected with a conflict message, the external content is preserved, and the dialog remains open with the entered values

#### Scenario: Reload after conflict

- **WHEN** the user reloads after a conflict
- **THEN** the board shows the externally modified content and a subsequent save uses the new revision

### Requirement: External change detection

The extension SHALL observe `.ikanban/**/*.yaml` using a filesystem watcher and SHALL react to file creation, modification and deletion, including external task moves and board configuration changes. Watcher events SHALL be debounced so a burst of changes causes at most one board reload. The extension SHALL suppress refresh loops caused by its own writes. An externally introduced invalid file SHALL produce diagnostics and SHALL NOT crash the extension or hide unaffected valid data.

#### Scenario: External task creation appears

- **WHEN** a valid task YAML file is added to a column directory outside VS Code
- **THEN** the open board shows the new task after the debounced refresh

#### Scenario: External deletion disappears

- **WHEN** a task YAML file is deleted outside VS Code
- **THEN** the task disappears from the open board and its diagnostics are cleared

#### Scenario: External invalid edit does not crash

- **WHEN** a task file is changed externally into malformed YAML
- **THEN** the board remains open, valid tasks remain visible, and the malformed file gets a diagnostic

#### Scenario: No refresh loop from own writes

- **WHEN** the extension writes a task file as part of a user action
- **THEN** the resulting watcher event does not trigger a redundant reload loop or duplicate mutation

### Requirement: Serialized and recoverable mutations

Mutations SHALL be serialized so rapid repeated operations do not interleave reads and writes. Cross-file operations, such as moving a task between columns or deleting a column, SHALL use a defined order and best-effort rollback. The extension SHALL NOT claim database-like atomicity across multiple YAML files, but a failed operation SHALL leave the board in a valid previous or completed state and SHALL report what happened.

#### Scenario: Failed move keeps the source

- **WHEN** writing a task into the target column fails during a move
- **THEN** the source task file remains unchanged and the board still shows the task in its original column

#### Scenario: Failed source deletion rolls back the target

- **WHEN** a task has been written to the target column but deleting the source file fails
- **THEN** the extension removes the target copy and reports a storage error instead of leaving duplicate task files

#### Scenario: Failed column deletion restores the board list

- **WHEN** removing an empty column directory fails after its reference was removed from `board.yaml`
- **THEN** the reference is restored or the error is reported without leaving a column directory silently orphaned

#### Scenario: Rapid operations stay consistent

- **WHEN** multiple create, update and move requests arrive in quick succession
- **THEN** they are processed in order and the final persisted files match the final requested state

### Requirement: Persisted files are the authoritative source

The YAML files on disk SHALL remain the authoritative source of truth. Any in-memory state or parse cache SHALL NEVER override newer persisted content and SHALL be discarded or revalidated when the underlying file changes. Refreshing or reopening the board SHALL reflect the current disk contents.

#### Scenario: Manual edit wins after refresh

- **WHEN** a task title is changed directly in the YAML file and the board is refreshed
- **THEN** the board displays the manually edited title

#### Scenario: Cache never masks disk changes

- **WHEN** a cached parse result exists for a file whose content digest has changed
- **THEN** the extension reparses the current content instead of reusing the stale result
